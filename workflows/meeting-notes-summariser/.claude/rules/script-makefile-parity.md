# Script–Makefile–CLAUDE.md Parity

Every script in `.claude/scripts/` that Claude invokes during workflows must also have a corresponding Makefile target and a row in the CLAUDE.md pipeline/utility tables. This ensures scripts are discoverable, auto-approved via `make *`, and always used instead of manual command construction.

## When adding a new script

1. Create the script in `.claude/scripts/` (and the project's content scripts directory for dogfooding parity).
2. Add a Makefile target that wraps it (unless exempt — see below).
3. Add a row to the appropriate CLAUDE.md table (PR pipeline or Dev utilities).
4. Add a row to `.claude/scripts/README.md` in the appropriate category.
5. Add a row to `docs/script-catalog.md` in the appropriate category with the "Referenced by" column.
6. Run `make refresh-stats` to update the script count markers.

## When removing a script

1. Remove the Makefile target.
2. Remove the CLAUDE.md table row.
3. Remove from `enforce-script-usage.sh` if it was referenced there.
4. Remove the row from `.claude/scripts/README.md`.
5. Remove the row from `docs/script-catalog.md`.
6. Run `make refresh-stats` to update the script count markers.

## When renaming or moving a script

1. Update all references: Makefile, CLAUDE.md, `.claude/scripts/README.md`, `docs/script-catalog.md`, and any rule/skill files that reference it.
2. Update the dogfooding copy.
3. Run `make refresh-stats`.

## Why

- `make *` is pre-approved in settings.json — Makefile targets auto-approve without the worktree hook.
- CLAUDE.md is always in context — the tables tell Claude what commands to use before it improvises.
- `enforce-script-usage.sh` is the safety net — it blocks anti-patterns and redirects to the correct script. But prevention (CLAUDE.md) is better than correction (hook).

## Exemptions

Not every script needs a Makefile target. These are exempt:

- **Hook scripts** (`guard-master-edits.sh`, `enforce-script-usage.sh`, `approve-worktree-commands.sh`) — infrastructure, not invoked directly.
- **Git workflow scripts** (`stage-all-files.sh`, `stage-files.sh`, `commit-staged.sh`) — require dynamic arguments that don't fit Makefile ergonomics.
- **Worktree lifecycle scripts** (`create-worktree.sh`, `setup-worktree-venv.sh`, `setup-worktree-permissions.sh`, `cleanup-worktree-permissions.sh`) — contextual, not pipeline steps.
- **PR comment agent scripts** (`pr-comment-agent-*.sh`) — invoked by the `/pr` skill internally, not standalone.
- **Release scripts** (`finalize-release.sh`, `cut-release-branch.sh`, `generate-release-lineage.sh`) — invoked by CI or release workflows.
- **Next/retro analyzer scripts** (`next-*.sh`, `retro-*.sh`) — invoked by skills internally.
- **Telemetry scripts** (`pr-telemetry.sh`, `pr-telemetry-summary.sh`) — invoked by the `/pr` skill internally at step boundaries.
- **Lean Claude scripts** (`lean-claude.sh`, `estimate-loop-tokens.sh`) — require dynamic prompt/iteration arguments that don't fit Makefile ergonomics; same rationale as git workflow scripts.
