---
bump: minor
---

### Added

- `setup_command` field on scaffold workflows: runs once after first clone (re-runs on command change) to install dependencies into the cache directory — no manual venv setup needed
- Automatic venv activation: if `setup_command` creates a `.venv`, it is sourced before Claude opens so all CLI tools are on PATH for the entire session
- Web Scraper now clones from GitHub (authoritative, committed state) and installs its own venv on first use
