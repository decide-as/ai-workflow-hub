### Coverage Report

**Tests:** 64 passed, 0 failed across 7 test files

This is a TypeScript/Node project with Vitest — no line-coverage gate is configured.

| Test File | Tests | Status |
|---|---|---|
| `tests/employee-gifts.test.ts` | 17 | PASS |
| `tests/registry.test.ts` | 3 | PASS |
| `tests/cli.test.ts` | 4 | PASS |
| `tests/terminal.test.ts` | 11 | PASS |
| `tests/runner.test.ts` | 14 | PASS |
| `tests/schedule.test.ts` | 9 | PASS |
| `tests/clustering.test.ts` | 6 | PASS |

The new `employee-gifts.test.ts` covers all 3 user-specified scenarios plus 4 edge cases including straddle, already-exhausted, over-limit previous total, and exact-limit.
