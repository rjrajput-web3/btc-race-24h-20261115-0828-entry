// Sharp-dip scalper for cbBTC (agent-fun/bars-replay/v1), long only, paper money.
//
// Idea: on a 1-minute cbBTC/USDC replay the price drifts and whipsaws, but sharp
// drops snap back. This bot sits in cash through the drift and only buys a sharp
// dip, then scalps a small rebound and gets out. Two independent dip triggers:
//
//   A. the close is at least 1.8% below the highest close of the last 30 bars
//      (a fast flush, ~30 minutes of selling), or
//   B. the close is at least 3.0% below the highest close of the last 240 bars
//      (a deeper 4-hour washout).
//
// Either trigger buys 60% of cash. Sizing at 60% (not 100%) keeps the
// constant-product price impact small: a full-size round trip pays ~26-40 bps in
// fee + slippage + impact, so a smaller ticket leaves more of the rebound.
//
// Exits, read again on every bar while holding:
//   - take profit: the position is worth 0.8% more than its cost (fees included),
//   - stop loss: the position is worth 2.0% less than its cost, and a stop-loss
//     exit starts a 15-bar cooldown before the next entry, so a falling market
//     cannot re-trigger a buy bar after bar.
// Both are checked against the position's cost basis from the account, so the
// thresholds already include every fee the fills paid. No exit is ever chased
// across bars: a sell the market refuses is simply sent again next bar.
//
// Everything is a pure function of the bars seen so far: no clock, no
// environment, no randomness, so two runs on the same window produce the same
// orders byte for byte. Indicators run in float64 on the close prices only;
// prices are ~7e9 micro-USDC, exactly representable, and the comparisons use
// ratios, so float rounding cannot flip a trigger.
//
// Laid out like an entrant's repository: the grader runs `node /bot/main.ts`
// with this directory mounted at /bot; vendor/makefun-bars.ts is a
// byte-identical copy of the kit's sdk/makefun-bars.ts (the kit's makefun-bars
// shim, left out of the authorship counts when kept under vendor/).

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

/** Bars of history kept for the slow trigger (4 hours). */
const SLOW_BARS = 240;
/** Bars of history for the fast trigger (30 minutes). */
const FAST_BARS = 30;
/** Fast trigger: close at or below (1 - FAST_DROP) of the 30-bar high. */
const FAST_DROP = 0.018;
/** Slow trigger: close at or below (1 - SLOW_DROP) of the 240-bar high. */
const SLOW_DROP = 0.03;
/** Fraction of cash staked on each entry. */
const STAKE_FRACTION = 0.6;
/** Take profit: position value at least this multiple of its cost. */
const TAKE_PROFIT = 1.008;
/** Stop loss: position value at most this multiple of its cost. */
const STOP_LOSS = 0.98;
/** Stop-loss cooldown: after a stop-loss exit, wait this many bars before buying again,
    so a still-falling market cannot re-trigger an entry bar after bar. */
const STOP_COOLDOWN_BARS = 15;
/** Orders may fill at most 1% past the close they were decided on. */
const MAX_SLIPPAGE_BPS = 100;

const SYMBOL = 'CBBTC';

/** The closes seen so far, oldest first, capped at SLOW_BARS. */
const closes: number[] = [];
/** First bar index on which a new entry is allowed again (after a stop-loss). */
let coolUntil = -1;

/** Highest close among the last `n` bars (the current bar included). */
function rollingHigh(n: number): number | null {
  if (closes.length < n) return null;
  let high = -Infinity;
  for (let i = closes.length - n; i < closes.length; i++) {
    if (closes[i]! > high) high = closes[i]!;
  }
  return high;
}

/** Whether a held position exits on this close: take profit or stop loss. A stop-loss
    exit also starts the re-entry cooldown, counted in bars from this batch. */
function exits(state: BarsState, held: { qty: bigint; cost: bigint }): boolean {
  const value = state.value(SYMBOL, held.qty);
  // Compare in integers: value * 1000 >= cost * 1008, and value * 100 <= cost * 98.
  if (value * 1000n >= held.cost * 1008n) return true;
  if (value * 100n <= held.cost * 98n) {
    coolUntil = state.seq + STOP_COOLDOWN_BARS;
    return true;
  }
  return false;
}

await runBars({
  onBatch(state, batch) {
    for (const bar of batch.bars) {
      if (bar.symbol !== SYMBOL) continue;
      closes.push(Number(bar.c));
      if (closes.length > SLOW_BARS) closes.shift();
    }
    if (state.warmingUp) return [];

    const close = state.close(SYMBOL);
    if (close === null) return [];

    const held = state.positions.get(SYMBOL);
    if (held !== undefined) {
      if (exits(state, held)) {
        const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [sell];
      }
      return [];
    }

    const fastHigh = rollingHigh(FAST_BARS);
    const slowHigh = rollingHigh(SLOW_BARS);
    const c = Number(close);
    const dipped =
      state.seq >= coolUntil &&
      ((fastHigh !== null && c <= fastHigh * (1 - FAST_DROP)) ||
        (slowHigh !== null && c <= slowHigh * (1 - SLOW_DROP)));
    if (!dipped) return [];

    // Stake 60% of cash, capped by the weight room (100% of equity here).
    let stake = (state.cash * 6n) / 10n;
    const room = state.weightRoom(SYMBOL);
    if (stake > room) stake = room;
    if (stake < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: stake, max_slippage_bps: MAX_SLIPPAGE_BPS };
    return [buy];
  },
});
