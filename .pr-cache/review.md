### Code Review

**Stage:** MVP  
**Scope:** 4 changed files — `src/main/machine-config.ts`, `tests/__mocks__/electron.ts`, `tests/machine-config.test.ts`, `vitest.config.ts`

**Verdict for current stage:** WORLD-CLASS FOR THIS STAGE  
**Ready to advance?** Contributes to Alpha readiness (unit tests for core path)

---

#### Correctness

- `readMachineConfigFromPath` extracts the pure I/O logic from `readMachineConfig` without any behavior change. The delegation `readMachineConfig() → readMachineConfigFromPath(getMachineConfigPath())` is correct.
- The Electron mock exports both named (`app`) and default (`{ app }`) — covers both import styles in the codebase.
- `vitest.config.ts` alias resolves `electron` to the stub before any source file imports it.

#### Security

No new runtime code paths. The refactor does not change how the config file is read, parsed, or validated. No new input surface.

#### Maintainability

- Naming is clear: `readMachineConfigFromPath` vs `readMachineConfig` follows the project's convention of suffixing path-injectable helpers with `FromPath`.
- No dead code or unused imports introduced.
- The mock is minimal and correctly typed.

#### Test quality

14 tests covering:
- `readMachineConfigFromPath`: missing file, valid JSON, malformed JSON, empty file, multi-entry config — all meaningful, no trivial identity assertions.
- `mergeRegistryWithMachineConfig`: empty config short-circuit (reference identity), all-enabled pass-through, single disabled, multiple disabled, all disabled, unknown ID ignored, cluster list preserved, immutability, mixed enabled/disabled.

The immutability test and the unknown-ID test are particularly valuable — they cover contracts that aren't obvious from the function signature alone.

#### Documentation

`docs/designs/design-2026-06-21-workflow-availability-phase1.md` describes `readMachineConfig()` as the public interface — unchanged. `readMachineConfigFromPath` is an internal extraction not worth adding to the design doc. No update needed.

---

**Blocking issues:** None  
**Advancement blockers:** None — this PR directly addresses the Alpha readiness blocker noted in the prior review.  
**Out-of-scope issues:** None
