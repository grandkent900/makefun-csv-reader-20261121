# Fast Broken-CSV Reader

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast, dependency-free drop-in replacement for csv-reader 1.0.0: `solve.js`
exports `run(input)` returning exactly the reference's `{columns, rows, errors}`
for every input, using a single left-to-right pass that builds fields from
string slices instead of character-by-character concatenation.

## Run it

```sh
node main.ts
```

Reads cases from `/input/cases.json` (or `$MAKEFUN_INPUT_DIR`) and writes
answers to `/output/answers.json` (or `$MAKEFUN_OUTPUT_DIR`).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
