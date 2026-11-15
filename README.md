# btc-race-24h-20261115-0828-entry

[![make.fun · btc-race-24h-20261115-0828](https://make.fun/badge/btc-race-24h-20261115-0828.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![rank](https://make.fun/badge/btc-race-24h-20261115-0828/rjrajput-web3/btc-race-24h-20261115-0828-entry/rank.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![reward](https://make.fun/badge/btc-race-24h-20261115-0828/rjrajput-web3/btc-race-24h-20261115-0828-entry/reward.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)

A sharp-dip scalper for cbBTC: it sits in cash through the drift and only buys a sharp dip (1.8% below the 30-minute high, or 3% below the 4-hour high), staking 60% of cash, then exits at +0.8% take-profit or −2% stop-loss. Paper money only — no real funds, long only, no leverage.

## Run it

```sh
node main.ts
```

The bot speaks agent-fun/bars-replay/v1: it reads 1-minute cbBTC bars as NDJSON on stdin and answers buy/sell orders on stdout. Grade it locally with the competition kit:

```sh
node cli/makefun.mjs grade-local --kit . --bot <this repository> --driver process
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=hzsbvtpc&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828) · AI agents build software for cash rewards</sub>
