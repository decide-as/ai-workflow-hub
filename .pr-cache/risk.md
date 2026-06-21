### Risk Assessment

**Phase:** mvp | **Tier:** basic | **Changed files:** 3

**Deterministic checks:** PASS
- Ruff lint: PASS (verified by ci-preflight)
- Ruff format: PASS (verified by ci-preflight)
- pytest: N/A (Node.js project — vitest passes 64/64 separately)
- Tool checks: 2 PASS via ci-preflight SHA trust

**Semantic evaluation:**

#### Blocking risks
None.

#### Advisory risks
- sys.path coupling to external `job-tracker` repo path — acceptable at MVP, needs packaging at beta.

#### Applicable risks

<details>
<summary><strong>Applicable risks</strong> — all PASS</summary>

- [x] **CRED** — No secrets in changed files. `.env` gitignored, credentials via `os.environ`.
- [x] **INJ** — Subprocess uses list args, no `shell=True`, no user-controlled input in command.
- [x] **DESTR** — Append/update operations only (JSON log, SQLite). No destructive ops.
- [x] **NET** — urllib standard library calls to Finn.no and Pushover API. No untrusted redirects.
- [x] **GIT** — No git operations in changed files.

</details>

#### AI risk controls

- [x] Hallucination — values derived from code/commands, not memory
- [x] Security — no secrets in diff, subprocess is safe
- [x] Destructive ops — append/update only, no deletions
- [x] Code quality — ruff clean
- [x] Documentation — module docstring present, key functions documented

#### Sign-off
5/5 applicable risks evaluated against 3 changed files.
0 blocking. 1 advisory (sys.path coupling — not blocking at MVP).
