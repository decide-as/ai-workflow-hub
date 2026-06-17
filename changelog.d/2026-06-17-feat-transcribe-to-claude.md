---
bump: minor
---

### Added

- Add `transcribe_to_claude` flag to workflow registry — when set on a `claude`-action workflow, an inline voice recorder appears on the card below the "Open in Claude" button, separated by an "or transcribe" divider.
- After transcription completes, the text is automatically passed as the initial prompt when opening Claude, seeding the session with the spoken content (clipboard copy still occurs as well).
- Extend `openWorkflow` IPC call through the full stack (handler, preload bridge, type declarations, `handleOpen`) to accept an optional `initialPrompt` parameter; the no-prompt path is unchanged.
