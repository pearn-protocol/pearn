# Regression tests

One named test per fixed bug. Each test's name carries the issue number (`test_regression_<n>_…`), so `git grep regression_<n>` finds it. `node scripts/regressions.mjs` (run in CI) fails if a test listed here no longer exists. Add a row with every `fix:` PR.

| Bug | Fixed in | Test | Pins |
|---|---|---|---|
| #16 | #15 | `contracts/test/unit/NearJson.t.sol` `test_regression_16_signIsInvalidNotPanic` | A sign or space inside a `U128` string reverts with `InvalidU128Json`, never an arithmetic panic |
