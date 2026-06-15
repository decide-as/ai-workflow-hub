#!/usr/bin/env bash
#
# Parallel CI pre-flight runner.
#
# Runs the same checks as `make ci-local` but groups independent targets into
# parallel batches.  Each target's output is captured and replayed sequentially
# to avoid interleaving.
#
# Outputs the HEAD SHA on success — callers use this for downstream cache reuse
# (--reuse-coverage, --trust-tool-checks) with automatic fallback if code changes.
#
# Usage:
#   bash .claude/scripts/ci-local-parallel.sh
#
# Exit code:
#   0  All checks passed.  Prints "CI_PREFLIGHT_SHA=<sha>" on the last line.
#   1  One or more checks failed.  Prints failure summary.

# No -e: exit codes are managed manually via the FAILURES array.
# A failing make target must not abort the script — we collect all failures
# and report them at the end.
set -uo pipefail

# ---- Ensure we are inside a Git repository -----------------------------------
if ! GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then
  echo "[!!] Not inside a Git repository." >&2
  exit 1
fi
cd "$GIT_ROOT"

TMPDIR_BASE=$(mktemp -d)
trap 'rm -rf "$TMPDIR_BASE"' EXIT

FAILURES=()

# Run a make target, capture output, return exit code.
_run_target() {
  local target="$1"
  local outfile="$TMPDIR_BASE/${target}.out"
  local rc=0
  make "$target" >"$outfile" 2>&1 || rc=$?
  echo "$rc" > "$TMPDIR_BASE/${target}.rc"
  return "$rc"
}

# Print captured output for a target with a header.
_replay() {
  local target="$1"
  local outfile="$TMPDIR_BASE/${target}.out"
  local rcfile="$TMPDIR_BASE/${target}.rc"
  local rc
  rc=$(cat "$rcfile" 2>/dev/null || echo "?")

  if [[ "$rc" == "0" ]]; then
    echo "──── $target ──── [PASS]"
  else
    echo "──── $target ──── [FAIL]"
  fi
  cat "$outfile"
  echo ""
  return "$rc"
}

# Run a batch of targets in parallel, then replay results sequentially.
_run_batch() {
  local targets=("$@")
  local pids=()

  for target in "${targets[@]}"; do
    _run_target "$target" &
    pids+=($!)
  done

  # Wait for all — don't short-circuit
  for pid in "${pids[@]}"; do
    wait "$pid" 2>/dev/null || true
  done

  # Replay in order and collect failures
  for target in "${targets[@]}"; do
    _replay "$target" || FAILURES+=("$target")
  done
}

echo "═══════════════════════════════════════════════════════"
echo " CI PRE-FLIGHT (parallel mode)"
echo "═══════════════════════════════════════════════════════"
echo ""

# ---- Batch 1: fast independent checks (parallel) ----------------------------
echo "[--] Batch 1: lint, typecheck, security, validation, structural..."
_run_batch validate-changelog lint typecheck validate-meta security dogfood

# ---- Batch 2: test suite (sequential — needs exclusive .pytest_cache) --------
echo "[--] Batch 2: coverage, markers..."
_run_batch coverage
_run_batch check-markers

# ---- Batch 2b: stats freshness (must run after coverage updates coverage.json)
echo "[--] Batch 2b: check-stats (post-coverage)..."
_run_batch check-stats

# ---- Batch 3: risk-check (may reuse batch 1 results via mypy cache) ---------
echo "[--] Batch 3: risk-check..."
_run_batch risk-check

# ---- Summary -----------------------------------------------------------------
echo "═══════════════════════════════════════════════════════"
if [[ ${#FAILURES[@]} -eq 0 ]]; then
  SHA=$(git rev-parse HEAD)
  echo "[ok] All checks passed"
  echo ""
  echo "CI_PREFLIGHT_SHA=$SHA"
  exit 0
else
  echo "[!!] FAILED targets: ${FAILURES[*]}"
  echo ""
  echo "[--] Fix all failures and re-run."
  exit 1
fi
