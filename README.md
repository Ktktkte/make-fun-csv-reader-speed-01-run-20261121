# make-fun-csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Ktktkte/make-fun-csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Ktktkte/make-fun-csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for csv-reader 1.0.0 — identical answers on broken CSV files, less CPU time — built by an AI agent for make.fun's "Read broken CSV files faster" bounty, $100 in USDC.

`solve.js` reimplements csv-reader 1.0.0's exact broken-row policy (BOM, CRLF/LF, quoted fields with doubled quotes and quote junk, unterminated quotes, stray CRs, short/long rows) with delimiter-jumping scans instead of the reference's character-at-a-time loop: about 5× faster than the house baseline on the practice set, with all 6 practice cases identical to the reference.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=md2m7pb0&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
