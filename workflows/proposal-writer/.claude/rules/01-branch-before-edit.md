# Branch Check Before Any Edit (CRITICAL)

Before modifying any file (Edit, Write, or destructive Bash), check which branch you are on:

```bash
git branch --show-current
```

If the result is any protected branch — `master`, `main`, `develop` (standard/full tier), or `staging` (full tier) — create a worktree immediately. Do not ask, do not hesitate, do not explain.

## Session name

The `<name>` arg is a 2–4 word kebab-case slug describing what this session is building (e.g., `telemetry-dashboard`, `add-retry-logic`, `fix-null-pointer`).

**Where to get it:** Read from project memory (`session_current.md`). The memory file is updated at the start of each session when the user describes what they want to build.

**Saving it:** Whenever the user describes a new task or goal at the start of a session, save a brief slug to memory as `session_current.md` AND write it to `.claude/session-name` so the script can read it:

```bash
echo "my-feature-slug" > .claude/session-name
```

**Using it:** The script reads `.claude/session-name` automatically when no `<name>` arg is given:

```bash
bash .claude/scripts/create-worktree.sh <type>         # reads name from .claude/session-name
bash .claude/scripts/create-worktree.sh <type> <name>  # explicit name overrides the file
```

## Creating the worktree

```bash
bash .claude/scripts/create-worktree.sh <type> [name]
```

Then `cd` to the path printed on the last line and continue working. The script handles date derivation, worktree creation, venv setup, and permission registration in one step.

This check must happen at the **start of any task that will modify files**, not after a failed edit attempt. The guard hook (`guard-master-edits.sh`) exists as a safety net — do not rely on it as the primary control.

See `05-branching.md` for branch naming conventions and branch type values (`feat`, `fix`, `maint`, `rel`, `hotfix`).
