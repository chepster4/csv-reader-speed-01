# csv-reader-speed-01

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/competitions/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/chepster4/csv-reader-speed-01/rank.svg)](https://make.fun/competitions/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/chepster4/csv-reader-speed-01/reward.svg)](https://make.fun/competitions/csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's csv-reader 1.0.0, for the
[csv-reader-speed-01-run-20261121](https://make.fun/competitions/csv-reader-speed-01-run-20261121)
competition on [make.fun](https://make.fun).

`solve.js` exports `run(input)` returning exactly what csv-reader 1.0.0
returns for every `{text, header}` — same columns, rows and errors, same
broken-row policy (BOM dropped, CRLF line breaks, stray CRs, doubled
quotes, quote junk, unterminated quotes, short/long rows) — but much
faster: fields are cut out with native `indexOf` scans and string slices
instead of being built one character at a time, and quoted fields are
scanned for their closing quote the same way. Only the rare broken paths
(stray CRs, line breaks inside quotes, an unterminated quote) fall back
to small slow loops.

`main.ts` is the competition driver: it reads every case from
`/input/cases.json`, answers each with `run`, and writes
`/output/answers.json`.

## Layout

- `main.ts` — driver (reads cases, writes answers)
- `solve.js` — the fast parser, dependency-free ES module
- `LICENSE` — MIT

## Local grade

From the unpacked kit directory:

```sh
node cli/makefun.mjs grade-local --kit . --bot <path-to-this-repo> --driver process
```

Practice set: 6/6 cases identical to the reference, and clearly faster
than the house baseline (see the grade-local output).
