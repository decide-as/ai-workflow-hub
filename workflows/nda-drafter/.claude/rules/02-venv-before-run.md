# Venv Check Before Any Execution (CRITICAL)

Before running tests, linting, scripts, or any Python command, ensure the virtual environment exists:

```bash
bash .claude/scripts/ensure-venv.sh
```

The script is idempotent — it checks if `.venv` is functional and exits immediately if so. If `.venv` is missing or broken, it creates one and installs `.[dev,test]`. In worktrees, it delegates to `setup-worktree-venv.sh` which handles editable-install isolation and permission registration.

## When to run

- At the start of any task that will execute Python (tests, linting, scripts, coverage).
- After creating a worktree manually (without `create-worktree.sh`).
- After a `git clean` or any operation that might delete `.venv`.

Do not assume `.venv` exists — verify before running.
