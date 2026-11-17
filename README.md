# Token Radar — Build the best token launch radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/dikawibowo2001-lab/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/dikawibowo2001-lab/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A make.fun bounty entry (`token-radar-01`): a dashboard that ranks pre-token
DeFi protocols by the implied value of a token launch, from a sealed
DefiLlama snapshot, and shows how to farm each one.

## The model

Implied value is anchored on the market, not guessed:

```
implied = TVL × peer multiple × growth × maturity × breadth
```

- **Peer multiple** — median mcap/TVL of the tokenized protocols in the same
  category, shrunk toward the global median by sample size, clamped to
  0.02–2.5. Categories with no tokenized peer use the global median.
- **Growth** — 1 + clamp(7-day TVL change, −50%, +100%) × 0.5.
- **Maturity** — 0.7 + min(age, 3y) / 3y × 0.3 (unknown age: 365 days).
- **Breadth** — 1 + 3% per extra chain, up to 1.15.

The board holds 200 rows: all 40 watchlist protocols plus the 160 strongest
pre-token protocols below the $50M floor by TVL. A separate airdrop-likelihood
signal (0–100) scores TVL scale, momentum, age with no token, category points
culture and chain breadth. Every row carries a 6-step farm plan generated from
its own category, chains, TVL and age, each step with a cost and a time.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input token-radar-01-kit/input/snapshot.json
node serve.ts   # http://localhost:8080/dashboard/
```

Shot scenes for screenshots: `?shot=board`, `?shot=detail`, `?shot=filtered`
— each sets `window.__shotReady` when rendered.

## Layout

- `main.ts` — entrypoint: reads the snapshot, writes `board.json`, `data.js`,
  copies `dashboard/` + `screenshots/`, writes `dossier.json`.
- `lib/model.ts` — the valuation model, the board builder, the farm planner.
- `dashboard/` — the static page (index.html, app.css, app.js). No network,
  no framework; all data from `data.js`.
- `vendor/makefun-board.ts` — the make.fun dossier library, vendored from the kit.
- `screenshots/` — the three screenshots: board, detail, filtered.

---

<sub>Entered on [make.fun](https://make.fun/?ref=n305kcfc&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
