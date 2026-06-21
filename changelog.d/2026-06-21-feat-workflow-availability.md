---
bump: minor
---

### Added

- Per-machine workflow availability via a Settings modal: workflows can be individually enabled or disabled per machine, stored in `machine-config.json` in Electron's userData directory.
- Machine nickname: machines can be given a human-readable name, editable inline in the Settings modal.
- Settings modal groups workflows by cluster (Finance, Utilities, etc.) with compact rows and section headers for easier scanning.
- Gear icon in the app header opens the Settings modal; Escape and backdrop click close it.
- Live config reload: changing `machine-config.json` externally pushes an updated registry to the renderer immediately via chokidar watcher.
- Phase 2 design doc for org-wide permissions management (design only — no runtime code yet).
