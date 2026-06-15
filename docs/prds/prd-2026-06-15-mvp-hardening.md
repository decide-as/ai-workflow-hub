---
id: prd-2026-06-15-mvp-hardening
title: MVP Hardening — Launch Verification, Tests, Error UX
owner: Christian Braathen
created: 2026-06-15
updated: 2026-06-15
status: draft
priority: P1
related_docs: []
---

# MVP Hardening

## Problem

The hub's core feature set is fully coded (card grid, Terminal launch via osascript,
CLI registration, auto-clustering) but none of it has been verified end-to-end, and
there are no automated tests. The app cannot be called MVP-grade while a click on
"Open in Claude ↗" has never been confirmed to work with a real macOS Terminal
session, and while failure modes (missing `claude` binary, macOS permission denial,
bad repo path) are unhandled in the UI.

## Context

`terminal.ts` uses `osascript` to open Terminal or iTerm2 and run
`cd "<path>" && claude`. The IPC channel is wired (`OPEN_WORKFLOW` → `openInTerminal`)
and the UI shows an error toast on failure. However:
- The osascript approach requires macOS Automation permission on first run — no
  prompt or guidance exists to help the user grant it.
- If `claude` is not on PATH in the shell that Terminal opens, the session silently
  fails.
- There are zero Vitest tests — `npm test` exits immediately with no output.
- The `itunesRunning()` function name is wrong (checks iTerm2, not iTunes).

## Goals

- The "Open in Claude ↗" flow works reliably on first and subsequent runs.
- Users are guided when macOS permission is needed or `claude` is missing.
- Basic automated tests catch regressions in registry, clustering, and CLI.

## Non-Goals

- Full E2E tests driving the Electron window (Playwright setup is out of scope).
- Cross-platform support (Linux/Windows Terminal launch).
- `claude` installation automation.

## Scope

### In Scope

- Fix `itunesRunning()` naming bug.
- Detect macOS Automation permission denial and surface a clear in-app message
  with instructions ("Open System Settings → Privacy & Security → Automation").
- Detect when `claude` is not found in PATH and surface a specific error message
  distinct from generic osascript failures.
- Vitest unit tests: registry YAML parsing, clustering engine, CLI `register`/`list`
  commands, `openInTerminal` with mocked `spawnSync`.
- Improve the error toast: show specific, actionable text rather than raw osascript
  stderr.

### Out of Scope

- Auto-installing `claude` CLI.
- Playwright/Spectron E2E tests.
- Windows/Linux Terminal launch.

## Success Criteria

1. Clicking "Open in Claude ↗" on a valid repo path opens a Terminal/iTerm2 window
   and runs `cd <path> && claude` — confirmed manually on macOS.
2. When macOS Automation permission is missing, the error toast says "Automation
   permission required — see System Settings › Privacy & Security › Automation".
3. When `claude` is not on PATH, the error toast says "claude not found in PATH —
   install from claude.ai".
4. `npm test` runs at least 10 passing Vitest unit tests covering registry parsing,
   clustering, CLI commands, and `openInTerminal` error paths.
5. No existing UI behaviour regresses.

## Users and Stakeholders

Solo user (Christian) running the app for personal workflow management and client
demos on macOS.

## Requirements

### Functional

- System must detect `osascript` exit code with "Not authorized" in stderr and
  return `{ success: false, errorKind: 'permission' }`.
- System must check for `claude` via `which claude` in the main process before
  launching osascript, returning `{ success: false, errorKind: 'claude-missing' }`
  when not found. Known limitation: PATH in a new Terminal window may differ.
- System must rename `itunesRunning()` to `isIterm2Running()`.
- System must expose `errorKind` through the IPC return type so the renderer
  can display targeted messages.
- System must include Vitest tests for: `readRegistry`, `writeRegistry`,
  `cluster()` with tag overlap, CLI `register` action, `openInTerminal` with
  mocked subprocess.

### Non-Functional

- `npm test` must complete in under 10 seconds.
- No new runtime dependencies (mocking via Vitest built-ins only).

## Affected Modules

| Module | Impact | Notes |
|---|---|---|
| `src/main/terminal.ts` | core | permission detection, rename, errorKind |
| `shared/types.ts` | interface | add `errorKind` to `OpenResult` |
| `src/renderer/src/App.tsx` | UI | render errorKind-specific toast messages |
| `tests/terminal.test.ts` | new | mock spawnSync, test error paths |
| `tests/registry.test.ts` | new | YAML round-trip |
| `tests/clustering.test.ts` | new | tag-overlap logic |
| `tests/cli.test.ts` | new | register / list commands |
| `vitest.config.ts` | new | configure test environment |

## Dependencies

- `vitest` — already installed (`^2.1.8`).
- No new packages needed.

## Risks

- macOS `osascript` permission detection via stderr string-matching is fragile —
  the error message may differ across macOS versions.
- `claude` PATH in the main process may not match PATH in a new Terminal window
  (e.g. if installed via a shell plugin like nvm/pyenv).

## Assumptions

- The hub runs on macOS 13+ (Ventura or later).
- `claude` is installed globally and available on PATH for new Terminal windows.

## Open Questions

- **Q:** Should `claude` PATH detection happen before launching osascript (checking
  via `which claude` in the main process) or after (by inspecting Terminal output)?
  **Recommendation:** Check via `which claude` in the main process before launching
  osascript. Fast, synchronous, avoids Terminal output parsing complexity. Flag
  PATH-discrepancy as a known limitation in the error message.
