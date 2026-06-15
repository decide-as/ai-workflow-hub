#!/usr/bin/env bash
#
# Retro analyzer: Velocity
#
# Analyzes commit cadence, work sessions (45-min gap heuristic),
# PR merge patterns, and hourly distribution.
#
# Usage:
#   bash retro-velocity.sh --since 2026-03-01 --until 2026-03-17
#
# Output: JSON to stdout. Info/errors to stderr.
# Compatible with bash 3.2+ (macOS default).

set -euo pipefail

# ---- Defaults ----------------------------------------------------------------
SINCE=""
UNTIL=""
REPO_ROOT=""

# ---- Parse arguments ---------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --since)     SINCE="$2"; shift 2 ;;
    --until)     UNTIL="$2"; shift 2 ;;
    --repo-root) REPO_ROOT="$2"; shift 2 ;;
    *)           echo "[!!] Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$SINCE" || -z "$UNTIL" ]]; then
  echo "[!!] --since and --until are required" >&2
  exit 1
fi

# ---- Ensure we are inside a Git repository -----------------------------------
if [[ -n "$REPO_ROOT" ]]; then
  git -C "$REPO_ROOT" rev-parse --show-toplevel >/dev/null 2>&1 || { echo "[!!] Not a Git repository: $REPO_ROOT" >&2; exit 1; }
  cd "$REPO_ROOT"
elif ! REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then
  echo "[!!] Not inside a Git repository." >&2
  exit 1
else
  cd "$REPO_ROOT"
fi

echo "[--] Analyzing velocity from $SINCE to $UNTIL" >&2

# ---- Collect commit timestamps (sorted) -------------------------------------
tmp_epochs=$(mktemp /tmp/retro_velocity_XXXXXX.txt)
tmp_hours=""
trap 'rm -f "$tmp_epochs" "$tmp_hours"' EXIT

git log --format="%at" --since="$SINCE" --until="$UNTIL" --no-merges 2>/dev/null \
  | sort -n > "$tmp_epochs" || true

TOTAL=$(wc -l < "$tmp_epochs" | tr -d ' ')

# ---- PR timing from persistent history ---------------------------------------
pr_history="${REPO_ROOT}/docs/telemetry/pr-history.yaml"
pr_avg_duration="null"
pr_median_duration="null"
pr_p90_duration="null"
pr_run_count=0
pr_slowest_step="null"
pr_slowest_step_avg="null"
pr_step_fail_rate="0"
pr_duration_trend="null"

if [[ -f "$pr_history" ]]; then
  # Use Python to parse YAML and compute stats within the time window
  pr_stats=$(python3 - "$pr_history" "$SINCE" "$UNTIL" <<'PYINLINE'
import sys, json
from datetime import datetime

try:
    import yaml
except ImportError:
    print("{}")
    sys.exit(0)

history_path, since_str, until_str = sys.argv[1], sys.argv[2], sys.argv[3]

with open(history_path) as f:
    docs = list(yaml.safe_load_all(f.read()))

runs = [d for d in docs if d and isinstance(d, dict)]
if not runs:
    print("{}")
    sys.exit(0)

# Parse dates for filtering
def parse_date(s):
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt)
        except (ValueError, TypeError):
            continue
    return None

since_dt = parse_date(since_str)
until_dt = parse_date(until_str)

# Filter runs within window
filtered = []
for r in runs:
    started = parse_date(str(r.get("started", "")))
    if started is None:
        continue
    if since_dt and started < since_dt:
        continue
    if until_dt and started > until_dt:
        continue
    filtered.append(r)

if not filtered:
    print("{}")
    sys.exit(0)

# Duration stats
chrono_durations = [r.get("duration_seconds", 0) for r in filtered]
durations = sorted(chrono_durations)
n = len(durations)
avg = sum(durations) / n
median = durations[n // 2] if n % 2 else (durations[n // 2 - 1] + durations[n // 2]) / 2
p90_idx = int(n * 0.9)
p90 = durations[min(p90_idx, n - 1)]

# Step aggregation
step_totals = {}  # name -> [durations]
step_failures = {}  # name -> count
total_steps = 0
for r in filtered:
    for s in r.get("steps", []):
        name = s.get("name", "")
        dur = s.get("duration_seconds", 0)
        outcome = s.get("outcome", "")
        step_totals.setdefault(name, []).append(dur)
        total_steps += 1
        if outcome == "fail":
            step_failures[name] = step_failures.get(name, 0) + 1

slowest_step = ""
slowest_avg = 0
for name, durs in step_totals.items():
    step_avg = sum(durs) / len(durs)
    if step_avg > slowest_avg:
        slowest_avg = step_avg
        slowest_step = name

total_fails = sum(step_failures.values())
fail_rate = (total_fails / total_steps * 100) if total_steps > 0 else 0

# Trend: compare first half vs second half (chronological order)
trend = "stable"
if n >= 4:
    first_half = chrono_durations[:n // 2]
    second_half = chrono_durations[n // 2:]
    avg_first = sum(first_half) / len(first_half)
    avg_second = sum(second_half) / len(second_half)
    if avg_first > 0:
        change = (avg_second - avg_first) / avg_first
        if change > 0.15:
            trend = "degrading"
        elif change < -0.15:
            trend = "improving"

result = {
    "run_count": n,
    "avg_duration": round(avg),
    "median_duration": round(median),
    "p90_duration": round(p90),
    "slowest_step": slowest_step,
    "slowest_step_avg": round(slowest_avg),
    "step_fail_rate": round(fail_rate, 1),
    "trend": trend,
}
print(json.dumps(result))
PYINLINE
  ) 2>/dev/null || true

  if [[ -n "$pr_stats" && "$pr_stats" != "{}" ]]; then
    pr_run_count=$(echo "$pr_stats" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('run_count',0))")
    pr_avg_duration=$(echo "$pr_stats" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('avg_duration','null'))")
    pr_median_duration=$(echo "$pr_stats" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('median_duration','null'))")
    pr_p90_duration=$(echo "$pr_stats" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('p90_duration','null'))")
    pr_slowest_step=$(echo "$pr_stats" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('slowest_step','')))")
    pr_slowest_step_avg=$(echo "$pr_stats" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('slowest_step_avg','null'))")
    pr_step_fail_rate=$(echo "$pr_stats" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('step_fail_rate',0))")
    pr_duration_trend=$(echo "$pr_stats" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('trend','stable')))")
  fi
fi

# ---- When no git commits: return skipped with PR metrics only ------
if [[ "$TOTAL" -eq 0 ]]; then
  cat <<EOJSON
{
  "analyzer": "velocity",
  "schema_version": 1,
  "skipped": true,
  "reason": "No commits in window",
  "metrics": {
    "pr_workflow_run_count": $pr_run_count,
    "pr_avg_duration_seconds": $pr_avg_duration,
    "pr_median_duration_seconds": $pr_median_duration,
    "pr_p90_duration_seconds": $pr_p90_duration,
    "pr_slowest_step": $pr_slowest_step,
    "pr_slowest_step_avg_seconds": $pr_slowest_step_avg,
    "pr_step_fail_rate_pct": $pr_step_fail_rate,
    "pr_duration_trend": $pr_duration_trend
  },
  "findings": []
}
EOJSON
  exit 0
fi

# ---- Active days -------------------------------------------------------------
active_days=$(git log --format="%ad" --date=short --since="$SINCE" --until="$UNTIL" --no-merges 2>/dev/null \
  | sort -u | wc -l | tr -d ' ')

if [[ $active_days -gt 0 ]]; then
  commits_per_day=$(awk "BEGIN {printf \"%.1f\", $TOTAL / $active_days}")
else
  commits_per_day="0"
fi

# ---- Session detection (45-min gap) ------------------------------------------
SESSION_GAP=2700  # 45 minutes in seconds
session_count=0
deep=0
shallow=0

prev_epoch=""
session_start=""

while IFS= read -r epoch; do
  [[ -z "$epoch" ]] && continue
  if [[ -z "$prev_epoch" ]]; then
    session_start="$epoch"
    prev_epoch="$epoch"
    continue
  fi

  gap=$((epoch - prev_epoch))
  if [[ $gap -gt $SESSION_GAP ]]; then
    # End current session
    session_duration=$((prev_epoch - session_start))
    session_minutes=$((session_duration / 60))
    if [[ $session_minutes -ge 50 ]]; then
      deep=$((deep + 1))
    elif [[ $session_minutes -lt 20 ]]; then
      shallow=$((shallow + 1))
    fi
    session_count=$((session_count + 1))
    session_start="$epoch"
  fi
  prev_epoch="$epoch"
done < "$tmp_epochs"

# Final session
if [[ -n "$prev_epoch" && -n "$session_start" ]]; then
  session_count=$((session_count + 1))
  session_duration=$((prev_epoch - session_start))
  session_minutes=$((session_duration / 60))
  if [[ $session_minutes -ge 50 ]]; then
    deep=$((deep + 1))
  elif [[ $session_minutes -lt 20 ]]; then
    shallow=$((shallow + 1))
  fi
fi

if [[ $session_count -gt 0 ]]; then
  deep_ratio=$(awk "BEGIN {printf \"%.2f\", $deep / $session_count}")
else
  deep_ratio="0"
fi

# ---- PR detection (merge commits) -------------------------------------------
pr_count=$(git log --merges --since="$SINCE" --until="$UNTIL" --oneline 2>/dev/null | wc -l | tr -d ' ')

avg_pr_size="null"
if [[ $pr_count -gt 0 ]]; then
  total_pr_lines=0
  while IFS= read -r merge_hash; do
    [[ -z "$merge_hash" ]] && continue
    pr_lines=$(git diff --shortstat "${merge_hash}^1" "$merge_hash" 2>/dev/null \
      | grep -oE '[0-9]+ insertion|[0-9]+ deletion' \
      | grep -oE '[0-9]+' \
      | awk '{s+=$1} END {print s+0}' || echo 0)
    total_pr_lines=$((total_pr_lines + pr_lines))
  done < <(git log --merges --format="%H" --since="$SINCE" --until="$UNTIL" 2>/dev/null || true)
  if [[ $total_pr_lines -gt 0 ]]; then
    avg_pr_size=$(awk "BEGIN {printf \"%.0f\", $total_pr_lines / $pr_count}")
  fi
fi

# ---- Hourly distribution (system timezone) -----------------------------------
tz=$(date +%Z 2>/dev/null || echo "UTC")

# Initialize all hours to 0, then count
tmp_hours=$(mktemp /tmp/retro_hours_XXXXXX.txt)
git log --format="%ad" --date=format:"%H" --since="$SINCE" --until="$UNTIL" --no-merges 2>/dev/null \
  > "$tmp_hours" || true

hourly_json="{"
for h in $(seq 0 23); do
  padded=$(printf "%02d" "$h")
  count=$(grep -c "^${padded}$" "$tmp_hours" 2>/dev/null || true)
  count=$(echo "$count" | tr -d '[:space:]')
  if [[ -z "$count" ]]; then count=0; fi
  if [[ $h -gt 0 ]]; then
    hourly_json="${hourly_json},"
  fi
  hourly_json="${hourly_json}\"${h}\":${count}"
done
hourly_json="${hourly_json}}"


# ---- Findings ----------------------------------------------------------------
finding_items=""

if [[ $deep -eq 0 && $session_count -gt 2 ]]; then
  finding_items="${finding_items}\"No deep work sessions detected (50+ min) — work appears fragmented\","
fi

if [[ $session_count -gt 0 && $((shallow * 100 / session_count)) -gt 60 ]]; then
  finding_items="${finding_items}\"${shallow} of ${session_count} sessions are micro (<20 min) — consider batching work into longer sessions\","
fi

if [[ $pr_run_count -gt 0 && "$pr_duration_trend" == '"degrading"' ]]; then
  finding_items="${finding_items}\"PR workflow duration is trending upward — investigate bottleneck steps\","
fi

if [[ "$pr_slowest_step" != "null" && "$pr_slowest_step" != '""' && $pr_slowest_step_avg != "null" && $pr_slowest_step_avg -gt 120 ]]; then
  # Strip JSON quotes from step name for embedding in finding string
  step_name=$(echo "$pr_slowest_step" | tr -d '"')
  finding_items="${finding_items}\"Slowest PR step is ${step_name} averaging ${pr_slowest_step_avg}s\","
fi

if [[ -n "$finding_items" ]]; then
  findings="[${finding_items%,}]"
else
  findings="[]"
fi

# ---- Output JSON -------------------------------------------------------------
cat <<EOJSON
{
  "analyzer": "velocity",
  "schema_version": 1,
  "skipped": false,
  "metrics": {
    "total_commits": $TOTAL,
    "active_days": $active_days,
    "commits_per_active_day": $commits_per_day,
    "session_count": $session_count,
    "deep_sessions": $deep,
    "shallow_sessions": $shallow,
    "deep_session_ratio": $deep_ratio,
    "pr_count": $pr_count,
    "avg_pr_size_lines": $avg_pr_size,
    "pr_workflow_run_count": $pr_run_count,
    "pr_avg_duration_seconds": $pr_avg_duration,
    "pr_median_duration_seconds": $pr_median_duration,
    "pr_p90_duration_seconds": $pr_p90_duration,
    "pr_slowest_step": $pr_slowest_step,
    "pr_slowest_step_avg_seconds": $pr_slowest_step_avg,
    "pr_step_fail_rate_pct": $pr_step_fail_rate,
    "pr_duration_trend": $pr_duration_trend,
    "hourly_distribution": $hourly_json,
    "timezone": "$tz"
  },
  "findings": $findings
}
EOJSON
