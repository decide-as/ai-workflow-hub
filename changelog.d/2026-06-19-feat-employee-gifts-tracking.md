---
bump: minor
---

### Added

- Employee Gift Tracker workflow with a three-phase modal (form → confirm → result) for documenting employee gifts under the Norwegian tax-free gift rule (5 000 NOK per employee per calendar year). Calculates the tax-free portion and taxable income split automatically.
- `shared/gift-tax.ts` — pure calculation module for the Norwegian gift tax rule, importable by both the renderer and the test suite.
- 17 new unit tests covering all three user-specified scenarios (first gift exceeding limit, first gift within limit, second gift with prior total) plus four edge cases (exact limit, exhausted limit, straddle, over-limit previous total).
