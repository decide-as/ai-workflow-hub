### Risk Assessment

**Phase:** mvp | **Tier:** 1 | **Changed files:** 6

**Deterministic checks:** PASS (lint + typecheck — Node project; pytest check N/A)

**Semantic evaluation:**

#### Blocking risks
None.

#### Advisory risks
None.

#### Applicable risks

<details>
<summary><strong>Applicable risks</strong> — 6/6 PASS</summary>

- [x] **INJ-01–10** — `initialPrompt` is written to a temp file and passed to `openInTerminal` via a bash launcher script. The existing escaping logic in `makeLauncherCommand` (single-quoted path, `cat` read into variable) correctly handles arbitrary text including quotes and newlines. No shell injection vector introduced.
- [x] **CRED-01–13** — No secrets in changed files. All changes are pure logic wiring.
- [x] **GIT-01–11** — No git operations introduced.
- [x] **PY-07** — N/A (Node project).
- [x] **API-01** — `openWorkflow` IPC signature extended with optional `initialPrompt?: string`. Existing callers pass no second arg — fully backward-compatible.
- [x] **UI-01** — `transcribe_to_claude` flag is opt-in per workflow; no existing card UI is changed unless the flag is set. The registry change only removes the flag from Travel Reimbursement (reverted to previous state).

</details>

#### AI risk controls

- [x] Hallucination — All values derived from code reads and explicit parameters; no assumed constants.
- [x] Deprecated patterns — No deprecated Electron or React APIs used.
- [x] Security — Transcribed text passed as initial prompt follows same temp-file escaping path as scaffold, which was previously reviewed.
- [x] Prompt injection — Transcribed audio content is user-controlled; it goes into Claude's initial prompt. This is intentional and expected behavior — same risk level as the scaffold feature.
- [x] Trust boundaries — IPC bridge correctly typed; renderer cannot execute arbitrary main-process code.
- [x] Destructive ops — No file deletion, no registry mutation.
- [x] Code quality — TypeScript strict mode; all 46 tests pass; no lint errors.
- [x] Documentation — Type comment added for `transcribe_to_claude` field.
- [x] Supply chain — No new dependencies introduced.
- [x] Operational — No new background processes, no new IPC channels.
- [x] Meta-assessment — All 6 changed files reviewed against the diff.

#### Sign-off
6/6 applicable risks evaluated against 6 changed files.
0 blocking. 0 advisory.
