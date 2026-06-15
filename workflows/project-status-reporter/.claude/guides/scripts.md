# Scripts — Reusable Shell Helpers

## What it is

Shell scripts stored in `.claude/scripts/` that provide reusable commands for rules, hooks, skills, or direct invocation. They are not auto-loaded — they are called explicitly when needed.

## Where it lives

- `.claude/scripts/` — Project-specific scripts, checked into git
- `~/.claude/scripts/` — Personal scripts across all projects (if you create this)

## When to use

- Complex shell logic that would be unwieldy inline in a hook
- Multi-step processes referenced from rules (like your staging/diff workflow)
- Shared validation or build steps called from multiple places
- Portable commands that should work the same for all team members

## When NOT to use

- Simple one-liners → inline them in hooks or rules directly
- Project build commands → use Makefile or package.json scripts
- Things that need Claude's judgment → use Skills instead

## Best practices

- Make scripts idempotent (safe to run multiple times)
- Use `set -euo pipefail` for safety
- Accept parameters rather than hardcoding paths
- Print useful output — scripts are often read by Claude to determine next steps
- Keep them small and focused — one script, one purpose

## Examples

### 1. Stage files and output diff to temp file

```bash
#!/usr/bin/env bash
# .claude/scripts/stage-files.sh
# Stage specific files and write the diff to a temp file
set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: stage-files.sh <file1> [file2] ..." >&2
  exit 1
fi

git add "$@"
tmpfile=$(mktemp /tmp/claude-diff-XXXXXX.txt)
git diff --cached > "$tmpfile"
echo "$tmpfile"
```

### 2. Get PR commit log

```bash
#!/usr/bin/env bash
# .claude/scripts/get-pr-commit-log.sh
# Fetch commit history for PR description
set -euo pipefail

base_branch=${1:-master}
current_branch=$(git branch --show-current)
repo_url=$(git remote get-url origin | sed 's/\.git$//' | sed 's|git@github.com:|https://github.com/|')

tmpfile=$(mktemp /tmp/claude-pr-log-XXXXXX.txt)
echo "REPOSITORY URL: $repo_url" > "$tmpfile"
echo "" >> "$tmpfile"
git log --oneline "$base_branch..$current_branch" >> "$tmpfile"
echo "$tmpfile"
```

### 3. Run all quality checks

```bash
#!/usr/bin/env bash
# .claude/scripts/check-quality.sh
# Run linter, formatter check, type checker, and tests
set -euo pipefail

echo "=== Ruff lint ==="
ruff check .

echo "=== Ruff format ==="
ruff format --check .

echo "=== Type check ==="
mypy src/ --ignore-missing-imports

echo "=== Tests ==="
pytest tests/ -v --tb=short

echo "=== All checks passed ==="
```

### 4. Validate environment setup

```bash
#!/usr/bin/env bash
# .claude/scripts/doctor.sh
# Check that all required tools and configs are present
set -euo pipefail

errors=0

check() {
  if command -v "$1" &>/dev/null; then
    echo "[ok] $1 found: $(command -v "$1")"
  else
    echo "[!!] $1 not found"
    errors=$((errors + 1))
  fi
}

check python3
check git
check ruff
check pytest

if [ -f ".env" ]; then
  echo "[ok] .env file exists"
else
  echo "[!!] .env file missing — copy from .env.example"
  errors=$((errors + 1))
fi

if [ "$errors" -gt 0 ]; then
  echo ""
  echo "$errors issue(s) found. Fix before proceeding."
  exit 1
fi
```

### 5. Generate test coverage report

```bash
#!/usr/bin/env bash
# .claude/scripts/coverage.sh
# Run tests with coverage and output summary
set -euo pipefail

pytest tests/ --cov=src --cov-report=term-missing --cov-report=html -q

echo ""
echo "HTML report: htmlcov/index.html"
```

### 6. Database reset for development

```bash
#!/usr/bin/env bash
# .claude/scripts/reset-db.sh
# Drop and recreate the dev database, apply all migrations
set -euo pipefail

DB_NAME=${1:-devdb}

echo "Dropping $DB_NAME..."
dropdb --if-exists "$DB_NAME"

echo "Creating $DB_NAME..."
createdb "$DB_NAME"

echo "Applying migrations..."
alembic upgrade head

echo "Seeding test data..."
python scripts/seed_data.py

echo "[ok] Database $DB_NAME reset and seeded"
```

### 7. Find large files not in gitignore

```bash
#!/usr/bin/env bash
# .claude/scripts/check-large-files.sh
# Warn about tracked files over a size threshold
set -euo pipefail

threshold_kb=${1:-500}

echo "Files over ${threshold_kb}KB tracked by git:"
git ls-files -z | xargs -0 -I{} sh -c '
  size=$(wc -c < "{}" 2>/dev/null || echo 0)
  if [ "$size" -gt '"$((threshold_kb * 1024))"' ]; then
    echo "  $(( size / 1024 ))KB  {}"
  fi
'
```

### 8. Sync environment from example

```bash
#!/usr/bin/env bash
# .claude/scripts/sync-env.sh
# Add missing keys from .env.example to .env (without overwriting existing)
set -euo pipefail

if [ ! -f .env.example ]; then
  echo "[!!] No .env.example found" >&2
  exit 1
fi

touch .env
added=0

while IFS= read -r line; do
  key=$(echo "$line" | cut -d= -f1)
  [ -z "$key" ] && continue
  [[ "$key" =~ ^# ]] && continue
  if ! grep -q "^${key}=" .env; then
    echo "$line" >> .env
    echo "[+] Added $key"
    added=$((added + 1))
  fi
done < .env.example

echo "[ok] $added new key(s) added to .env"
```

### 9. Clean build artifacts

```bash
#!/usr/bin/env bash
# .claude/scripts/clean.sh
# Remove generated files and caches
set -euo pipefail

echo "Cleaning Python caches..."
find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true

echo "Cleaning build artifacts..."
rm -rf build/ dist/ *.egg-info/ .eggs/

echo "Cleaning test artifacts..."
rm -rf .pytest_cache/ htmlcov/ .coverage

echo "Cleaning ruff cache..."
rm -rf .ruff_cache/

echo "[ok] Clean complete"
```

### 10. Check for common issues before PR

```bash
#!/usr/bin/env bash
# .claude/scripts/pre-pr-check.sh
# Run all checks that should pass before opening a PR
set -euo pipefail

echo "=== Checking for debug statements ==="
if grep -rn "breakpoint()\|import pdb\|print(" src/ --include="*.py" | grep -v "# noqa"; then
  echo "[!!] Found debug statements — remove before PR"
  exit 1
fi

echo "=== Checking for TODO/FIXME ==="
grep -rn "TODO\|FIXME\|HACK\|XXX" src/ --include="*.py" || echo "(none found)"

echo "=== Checking for unresolved merge conflicts ==="
if grep -rn "<<<<<<\|>>>>>>" src/ tests/; then
  echo "[!!] Found merge conflict markers"
  exit 1
fi

echo "=== Running quality checks ==="
bash .claude/scripts/check-quality.sh

echo ""
echo "[ok] All pre-PR checks passed"
```
