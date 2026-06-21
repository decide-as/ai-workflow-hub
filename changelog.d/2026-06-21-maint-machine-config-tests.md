---
bump: patch
---

### Added

- Unit tests for `readMachineConfigFromPath` covering missing file, valid JSON, malformed JSON, empty file, and multi-entry config
- Unit tests for `mergeRegistryWithMachineConfig` covering all filtering scenarios (empty config, all enabled, single/multiple/all disabled, unknown IDs, cluster preservation, immutability)
- Electron module stub (`tests/__mocks__/electron.ts`) enabling main-process modules to be tested under vitest without a real Electron runtime
- `readMachineConfigFromPath(path)` helper extracted from `readMachineConfig()` to make the pure I/O logic testable independently of `app.getPath`
