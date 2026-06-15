#!/usr/bin/env bash
# PR workflow telemetry summary.
#
# Reads .claude/telemetry/pr-runs.yaml and outputs a summary table
# showing per-step timing statistics across recent PR runs.
#
# Usage:
#   pr-telemetry-summary.sh [--last N] [--step <name>] [--format table|yaml]
#
# Options:
#   --last N       Show only the last N runs (default: 10)
#   --step <name>  Filter to a specific step name
#   --format       Output format: table (default) or yaml
#
# Environment:
#   PR_TELEMETRY_DIR  Override telemetry directory (default: .claude/telemetry)

set -euo pipefail

# In a worktree, --show-toplevel returns the worktree path. Telemetry lives
# in the main checkout so it persists across worktree removal.
GIT_COMMON=$(git rev-parse --git-common-dir 2>/dev/null || echo "")
if [[ -n "$GIT_COMMON" && "$GIT_COMMON" != ".git" ]]; then
  REPO_ROOT=$(cd "$GIT_COMMON/.." && pwd)
else
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
fi

# Prefer the project's venv Python (has PyYAML installed)
if [[ -x "${REPO_ROOT}/.venv/bin/python3" ]]; then
  PYTHON="${REPO_ROOT}/.venv/bin/python3"
else
  PYTHON="python3"
fi
TELEMETRY_DIR="${PR_TELEMETRY_DIR:-${REPO_ROOT}/.claude/telemetry}"
LOG_FILE="${TELEMETRY_DIR}/pr-runs.yaml"

LAST_N=10
STEP_FILTER=""
FORMAT="table"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --last)   LAST_N="$2"; shift 2 ;;
    --step)   STEP_FILTER="$2"; shift 2 ;;
    --format) FORMAT="$2"; shift 2 ;;
    *) echo "[!!] Unknown flag: $1" >&2; exit 1 ;;
  esac
done

if [[ ! -f "$LOG_FILE" ]]; then
  echo "[--] No telemetry data found at ${LOG_FILE}"
  exit 0
fi

# Use Python to parse multi-document YAML and produce the summary.
# This avoids needing yq or other external tools — Python + PyYAML are
# already available in the project venv.
"$PYTHON" - "$LOG_FILE" "$LAST_N" "$STEP_FILTER" "$FORMAT" <<'PYTHON'
import sys
import yaml
from collections import defaultdict
from pathlib import Path

log_file = sys.argv[1]
last_n = int(sys.argv[2])
step_filter = sys.argv[3] or None
fmt = sys.argv[4]

# Parse all YAML documents
with open(log_file) as f:
    runs = list(yaml.safe_load_all(f))

# Filter out None documents (empty YAML separators)
runs = [r for r in runs if r is not None]

if not runs:
    print("[--] No telemetry runs found.")
    sys.exit(0)

# Take last N
runs = runs[-last_n:]

if fmt == "yaml":
    yaml.dump(runs, sys.stdout, default_flow_style=False, sort_keys=False)
    sys.exit(0)

# --- Table format ---

# Overall run summary
print(f"=== PR Workflow Telemetry ({len(runs)} run{'s' if len(runs) != 1 else ''}) ===\n")

print(f"{'Branch':<45} {'Duration':>10} {'Outcome':<10} {'Steps':>5}")
print("-" * 75)
for run in runs:
    branch = run.get("branch", "?")
    if len(branch) > 44:
        branch = "..." + branch[-41:]
    dur = run.get("duration_seconds", 0)
    minutes = dur // 60
    seconds = dur % 60
    outcome = run.get("outcome", "?")
    step_count = len(run.get("steps", []))
    print(f"{branch:<45} {minutes:>4}m{seconds:02d}s {outcome:<10} {step_count:>5}")

print()

# Per-step statistics
step_durations = defaultdict(list)
step_outcomes = defaultdict(lambda: defaultdict(int))

for run in runs:
    for step in run.get("steps", []):
        name = step.get("name", "?")
        if step_filter and name != step_filter:
            continue
        dur = step.get("duration_seconds", 0)
        step_durations[name].append(dur)
        step_outcomes[name][step.get("outcome", "?")] += 1

if not step_durations:
    if step_filter:
        print(f"[--] No data for step '{step_filter}'")
    else:
        print("[--] No step data found.")
    sys.exit(0)

print(f"{'Step':<25} {'Avg':>8} {'Median':>8} {'Min':>8} {'Max':>8} {'Runs':>5} {'Pass%':>6}")
print("-" * 75)

for name in sorted(step_durations.keys()):
    durs = sorted(step_durations[name])
    n = len(durs)
    avg = sum(durs) / n
    median = durs[n // 2] if n % 2 == 1 else (durs[n // 2 - 1] + durs[n // 2]) / 2
    mn = durs[0]
    mx = durs[-1]
    outcomes = step_outcomes[name]
    pass_count = outcomes.get("pass", 0)
    pass_pct = (pass_count / n * 100) if n > 0 else 0

    def fmt_dur(s):
        if s >= 60:
            return f"{int(s)//60}m{int(s)%60:02d}s"
        return f"{int(s)}s"

    print(f"{name:<25} {fmt_dur(avg):>8} {fmt_dur(median):>8} {fmt_dur(mn):>8} {fmt_dur(mx):>8} {n:>5} {pass_pct:>5.0f}%")

print()

# Total run duration stats
total_durs = sorted([r.get("duration_seconds", 0) for r in runs])
n = len(total_durs)
avg = sum(total_durs) / n
median = total_durs[n // 2] if n % 2 == 1 else (total_durs[n // 2 - 1] + total_durs[n // 2]) / 2

def fmt_dur(s):
    if s >= 60:
        return f"{int(s)//60}m{int(s)%60:02d}s"
    return f"{int(s)}s"

print(f"Total run duration — avg: {fmt_dur(avg)}, median: {fmt_dur(median)}, "
      f"min: {fmt_dur(total_durs[0])}, max: {fmt_dur(total_durs[-1])}")
PYTHON
