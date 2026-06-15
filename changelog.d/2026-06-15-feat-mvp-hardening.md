---
bump: minor
phase: mvp
---

### Added

- Workflow detail modal with rich metadata: status, trigger type, run history, success rate, performance estimates, inputs, outputs, and workspace badge
- 12 self-contained workflow directories (workflows/<name>/) each with README, project-meta.yaml for one-command scaffold, and .claude/rules/task.md for Claude task instructions
- Vitest unit test suite (23 tests) covering clustering engine, registry YAML round-trip, CLI register/write logic, and terminal launch error paths
- Structured error handling for Terminal launch: distinguishes Automation permission denial, missing claude binary, and missing repo path with actionable UI messages

### Changed

- Advance project phase from prototype to mvp — quality gate moves to basic, risk tier to basic
- Terminal launch: renamed itunesRunning() → isIterm2Running(); added pre-flight checks before osascript invocation
- OpenResult type extended with errorKind discriminant for targeted renderer error messages
- Workflow directories stripped to minimal scaffoldable structure (3 files each) to prevent Claude Code context inheritance from hub's Node rules

### Fixed

- Registry path resolution when Electron launched with absolute entry path (app.getAppPath() returned out/main instead of project root)
