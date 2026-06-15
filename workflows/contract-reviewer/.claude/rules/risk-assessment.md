# Risk Assessment (CRITICAL -- run before every PR)

Run the deterministic risk assessment and semantic evaluation before every PR. Do not skip. Do not rubber-stamp.

---

## Step 1: Run the deterministic checks

```bash
bash .claude/scripts/check-risk-assessment.sh
```

If the phase was updated earlier in the PR workflow (e.g., prototype → MVP), pass the post-PR phase:

```bash
bash .claude/scripts/check-risk-assessment.sh --phase mvp
```

The script runs tier-appropriate pytest checks, ruff, and (at higher tiers) bandit and pip-audit. It produces a structured sign-off log.

- If **any deterministic check fails**, fix the issue and re-run before proceeding.
- The sign-off log is the evidence record for deterministic risks.

---

## Step 2: Semantic risk evaluation

After deterministic checks pass, evaluate the non-automatable risks.

### 2a. Use the filtered risk list

The script output includes a filtered list of applicable risks based on `project-meta.yaml` (language, category, capabilities, phase/tier). Evaluate **only** the risks in the filtered output. Do not walk through inapplicable categories.

To generate the filtered list independently (e.g., outside the full risk assessment script):

```bash
python3 .claude/scripts/filter-risks.py
```

If the filtered output is unavailable (e.g., `risk_filter` module not installed), fall back to the full reference files:

- `docs/risk/risk-matrix.md` — phase-graduated risk catalogue
- `docs/risk/ai-risk-controls.md` — AI-specific risks (always enforced)

### 2b. Identify scope

```bash
git diff --name-only origin/master...HEAD
```

### 2c. Evaluate

For each risk ID in the filtered applicable set (from the script output):

- **Applies and PASSES:** cite file:line inspected and why it passes.
- **Does not apply:** state why (not just "N/A").
- **FAILS:** describe what must be fixed.

Focus on the diff, not the entire codebase. Flag pre-existing issues separately.

---

## Output format

Copy this template exactly. Do not reorder, rename, or omit sections. Use the same heading levels shown here.

````markdown
### Risk Assessment

**Phase:** <phase> | **Tier:** <tier> | **Changed files:** <count>

**Deterministic checks:** PASS (see sign-off log)

**Semantic evaluation:**

#### Blocking risks
- <RISK-ID>: <file>:<line> — <issue>

#### Advisory risks
- <RISK-ID>: <file>:<line> — <becomes blocking at phase X>

#### Applicable risks

<details>
<summary><strong>Applicable risks</strong> — <N>/<N> PASS</summary>

Group evaluated risk IDs by category. Use `- [x]` for PASS, `- [ ]` for FAIL. Batch related IDs into ranges (e.g., `CRED-01–13`). One line per category with a short evidence note.

- [x] **CRED-01–13** — No secrets in changed files. All files are pure logic.
- [x] **GIT-01–11** — Read-only git operations, no force-push or history rewriting.
- [x] **INJ-01–10** — Subprocess calls use list args, no shell=True, no user-controlled input.
- [ ] **PY-07** — `src/foo.py:42` bare except swallows errors. Must fix.

</details>

#### AI risk controls

- [x] Hallucination — <evidence>
- [x] Deprecated patterns — <evidence>
- [x] Security — <evidence>
- [x] Prompt injection — <evidence>
- [x] Trust boundaries — <evidence>
- [x] Destructive ops — <evidence>
- [x] Code quality — <evidence>
- [x] Documentation — <evidence>
- [x] Supply chain — <evidence>
- [x] Operational — <evidence>
- [x] Meta-assessment — <evidence>

#### Sign-off
<N>/<N> applicable risks evaluated against <N> changed files.
<N> blocking. <N> advisory.
````

---

## Enforcement

- "No issues found" without evidence is a FAIL (AI-META-01).
- Every N/A must have a reason (AI-META-02).
- Assessment must reference the specific diff (AI-META-03).
- Every category in the tier must appear in output (AI-META-04).
- If verdict is FAIL: fix, commit, re-run until PASS.
