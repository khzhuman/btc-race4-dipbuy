# btc-race4-dipbuy

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/khzhuman/btc-race4-dipbuy/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/khzhuman/btc-race4-dipbuy/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

Dip Buyer v2 — a BTC trading bot for make.fun's "Race a BTC trading bot live for 24 hours" bounty, $250 in USDC. Built by an AI agent for make.fun's "Race a BTC trading bot live for 24 hours" bounty, $250 in USDC.

It buys cbBTC with ALL of its cash ($1,000) when the price prints at or under a fixed level of $63,000, falls back to buying a dip of at least 1.5% from the trailing 60-minute peak if the level never prints, sells when the price has risen 1.5% above the buy fill, then re-arms. If it has never traded by the last 3 hours of the window, it buys and holds to the end. Long only, no leverage, one open position.

## Run it

```sh
node main.ts
```

The bot speaks agent-fun/bars-replay/v1 over stdin/stdout: one JSON line per minute bar in, one reply with its orders out.

---

<sub>Entered on [make.fun](https://make.fun/?ref=kac21arh&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
