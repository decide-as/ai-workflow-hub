---
bump: patch
---

### Fixed

- `stage-all-files.sh` now detects and unstages symlinks pointing to gitignored directories (e.g. a `node_modules` worktree symlink), preventing accidental commits of ignored paths.
