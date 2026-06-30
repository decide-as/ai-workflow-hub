---
bump: patch
---

### Added

- `make install-app` target that builds the Electron app via `npm run dist` and installs it to `/Applications/Workflow Hub.app`, replacing any previous version.

### Fixed

- `install-app` target now removes the existing app bundle before copying to avoid `cp -r` directory-nesting when the app is already installed.
