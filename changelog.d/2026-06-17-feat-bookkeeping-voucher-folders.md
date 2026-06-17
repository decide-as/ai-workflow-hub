---
bump: minor
---

### Added
- Voucher Folder Creator workflow: drag-and-drop bank statement screenshots onto the card, Claude reads them via the local `claude -p` CLI subprocess, and one sub-folder per transaction is created in the configured output directory with Norwegian Title Case naming rules.
- `bookkeeping` action type for workflow cards with a full multi-phase inline UI (idle drop zone, processing spinner, done list, error state).
- `pickFolder` IPC call now accepts an optional `defaultPath` so the Finder folder picker opens pre-navigated to the configured output directory.
- `.claude/guides/claude-subprocess.md` documenting the preferred pattern for invoking Claude headlessly from the Electron main process without calling the Anthropic API directly.
