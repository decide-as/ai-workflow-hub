#!/usr/bin/env bash
set -euo pipefail

# Configure git to use the project's .githooks/ directory for hooks.
# Run once after cloning or when hooks are added/updated.

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

hooks_dir=".githooks"

if [[ ! -d "$hooks_dir" ]]; then
  echo "[!!] No $hooks_dir/ directory found." >&2
  exit 1
fi

# Make all hook scripts executable
for hook in "$hooks_dir"/*; do
  [[ -f "$hook" ]] && chmod +x "$hook"
done

git config core.hooksPath "$hooks_dir"

echo "[ok] core.hooksPath set to $(git config --get core.hooksPath)"
