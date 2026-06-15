#!/usr/bin/env bash
# PR workflow telemetry writer.
#
# Records timing and outcome data for each step of the /pr workflow.
# Data is appended to .claude/telemetry/pr-runs.yaml as multi-document YAML.
#
# Usage:
#   pr-telemetry.sh start-run --branch <branch> --target <target> --pr-type <type>
#   pr-telemetry.sh start-step --name <step-name>
#   pr-telemetry.sh end-step --name <step-name> --outcome <pass|fail|skip|retry> [--metric key=value ...]
#   pr-telemetry.sh end-run --outcome <merged|failed|abandoned> [--pr-number <N>]
#   pr-telemetry.sh cancel-run
#   pr-telemetry.sh persist-run
#
# Environment:
#   PR_TELEMETRY_DIR  Override telemetry directory (default: .claude/telemetry)
#   PR_HISTORY_DIR    Override persistent history directory (default: docs/telemetry)
#
# The script maintains a temporary in-progress file (.current-run.yaml) that is
# assembled into the final log entry on end-run.

set -euo pipefail

# --- Configuration -----------------------------------------------------------

# In a worktree, --show-toplevel returns the worktree path. Telemetry must
# accumulate in the main checkout so it survives worktree removal.
GIT_COMMON=$(git rev-parse --git-common-dir 2>/dev/null || echo "")
if [[ -n "$GIT_COMMON" && "$GIT_COMMON" != ".git" ]]; then
  REPO_ROOT=$(cd "$GIT_COMMON/.." && pwd)
else
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
fi
TELEMETRY_DIR="${PR_TELEMETRY_DIR:-${REPO_ROOT}/.claude/telemetry}"
LOG_FILE="${TELEMETRY_DIR}/pr-runs.yaml"
CURRENT_RUN="${TELEMETRY_DIR}/.current-run.yaml"
CURRENT_STEPS="${TELEMETRY_DIR}/.current-steps.yaml"

mkdir -p "$TELEMETRY_DIR"

# --- Helpers ------------------------------------------------------------------

iso_now() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

epoch_now() {
  date +%s
}

duration_seconds() {
  local start_epoch="$1"
  local end_epoch
  end_epoch=$(epoch_now)
  echo $(( end_epoch - start_epoch ))
}

# --- Commands -----------------------------------------------------------------

cmd_start_run() {
  local branch="" target="" pr_type=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --branch)  branch="$2"; shift 2 ;;
      --target)  target="$2"; shift 2 ;;
      --pr-type) pr_type="$2"; shift 2 ;;
      *) echo "[!!] Unknown flag: $1" >&2; exit 1 ;;
    esac
  done

  if [[ -z "$branch" || -z "$target" || -z "$pr_type" ]]; then
    echo "[!!] start-run requires --branch, --target, --pr-type" >&2
    exit 1
  fi

  local now
  now=$(iso_now)
  local run_id="${now}-$(echo "$branch" | sed 's|/|-|g' | tail -c 60)"

  cat > "$CURRENT_RUN" <<EOF
run_id: ${run_id}
branch: ${branch}
target: ${target}
pr_type: ${pr_type}
started: ${now}
start_epoch: $(epoch_now)
EOF

  # Clear any leftover steps
  : > "$CURRENT_STEPS"

  echo "[ok] Telemetry: run started (${run_id})"
}

cmd_start_step() {
  local name=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --name) name="$2"; shift 2 ;;
      *) echo "[!!] Unknown flag: $1" >&2; exit 1 ;;
    esac
  done

  if [[ -z "$name" ]]; then
    echo "[!!] start-step requires --name" >&2
    exit 1
  fi

  # Write a step-start marker file
  local step_file="${TELEMETRY_DIR}/.step-${name}"
  cat > "$step_file" <<EOF
name: ${name}
started: $(iso_now)
start_epoch: $(epoch_now)
EOF

  echo "[ok] Telemetry: step '${name}' started"
}

cmd_end_step() {
  local name="" outcome="" parallel_group=""
  local -a metrics=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --name)     name="$2"; shift 2 ;;
      --outcome)  outcome="$2"; shift 2 ;;
      --parallel) parallel_group="$2"; shift 2 ;;
      --metric)   metrics+=("$2"); shift 2 ;;
      *) echo "[!!] Unknown flag: $1" >&2; exit 1 ;;
    esac
  done

  if [[ -z "$name" || -z "$outcome" ]]; then
    echo "[!!] end-step requires --name and --outcome" >&2
    exit 1
  fi

  local step_file="${TELEMETRY_DIR}/.step-${name}"
  if [[ ! -f "$step_file" ]]; then
    echo "[!!] No start marker for step '${name}' — recording without duration" >&2
    local start_iso
    start_iso=$(iso_now)
    local start_epoch
    start_epoch=$(epoch_now)
  else
    local start_iso start_epoch
    start_iso=$(grep '^started:' "$step_file" | awk '{print $2}')
    start_epoch=$(grep '^start_epoch:' "$step_file" | awk '{print $2}')
    rm -f "$step_file"
  fi

  local end_iso end_epoch dur
  end_iso=$(iso_now)
  end_epoch=$(epoch_now)
  dur=$(( end_epoch - start_epoch ))

  # Append step entry to current steps file
  {
    echo "  - name: ${name}"
    echo "    started: ${start_iso}"
    echo "    finished: ${end_iso}"
    echo "    duration_seconds: ${dur}"
    echo "    outcome: ${outcome}"
    if [[ -n "$parallel_group" ]]; then
      echo "    parallel_group: ${parallel_group}"
    fi
    if [[ ${#metrics[@]} -gt 0 ]]; then
      echo "    metrics:"
      for m in "${metrics[@]}"; do
        local key="${m%%=*}"
        local val="${m#*=}"
        echo "      ${key}: ${val}"
      done
    fi
  } >> "$CURRENT_STEPS"

  echo "[ok] Telemetry: step '${name}' finished (${dur}s, ${outcome})"
}

cmd_end_run() {
  local outcome="" pr_number=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --outcome)   outcome="$2"; shift 2 ;;
      --pr-number) pr_number="$2"; shift 2 ;;
      *) echo "[!!] Unknown flag: $1" >&2; exit 1 ;;
    esac
  done

  if [[ -z "$outcome" ]]; then
    echo "[!!] end-run requires --outcome" >&2
    exit 1
  fi

  if [[ ! -f "$CURRENT_RUN" ]]; then
    echo "[!!] No active run — call start-run first" >&2
    exit 1
  fi

  local run_id branch target pr_type started start_epoch
  run_id=$(grep '^run_id:' "$CURRENT_RUN" | sed 's/^run_id: //')
  branch=$(grep '^branch:' "$CURRENT_RUN" | sed 's/^branch: //')
  target=$(grep '^target:' "$CURRENT_RUN" | sed 's/^target: //')
  pr_type=$(grep '^pr_type:' "$CURRENT_RUN" | sed 's/^pr_type: //')
  started=$(grep '^started:' "$CURRENT_RUN" | sed 's/^started: //')
  start_epoch=$(grep '^start_epoch:' "$CURRENT_RUN" | sed 's/^start_epoch: //')

  local finished
  finished=$(iso_now)
  local dur
  dur=$(( $(epoch_now) - start_epoch ))

  # Assemble the final YAML document and append to log
  {
    echo "---"
    echo "run_id: ${run_id}"
    echo "branch: ${branch}"
    echo "target: ${target}"
    echo "pr_type: ${pr_type}"
    if [[ -n "$pr_number" ]]; then
      echo "pr_number: ${pr_number}"
    fi
    echo "started: ${started}"
    echo "finished: ${finished}"
    echo "duration_seconds: ${dur}"
    echo "outcome: ${outcome}"
    if [[ -s "$CURRENT_STEPS" ]]; then
      echo "steps:"
      cat "$CURRENT_STEPS"
    fi
  } >> "$LOG_FILE"

  # Clean up temp files
  rm -f "$CURRENT_RUN" "$CURRENT_STEPS"
  rm -f "${TELEMETRY_DIR}"/.step-*

  echo "[ok] Telemetry: run finished (${dur}s, ${outcome}) → ${LOG_FILE}"
}

cmd_cancel_run() {
  rm -f "$CURRENT_RUN" "$CURRENT_STEPS"
  rm -f "${TELEMETRY_DIR}"/.step-*
  echo "[ok] Telemetry: run cancelled, temp files cleaned up"
}


cmd_persist_run() {
  # Reads the last YAML document from the local telemetry log and appends
  # a compact copy to the version-controlled history file.
  local history_dir="${PR_HISTORY_DIR:-${REPO_ROOT}/docs/telemetry}"
  local history_file="${history_dir}/pr-history.yaml"

  if [[ ! -f "$LOG_FILE" ]]; then
    echo "[!!] No telemetry log found at ${LOG_FILE}" >&2
    exit 1
  fi

  # Use Python to extract the last YAML document and write a compact record
  python3 - "$LOG_FILE" "$history_file" "$history_dir" <<'PYINLINE'
import sys, yaml
from pathlib import Path

log_path = Path(sys.argv[1])
history_path = Path(sys.argv[2])
history_dir = Path(sys.argv[3])

# Load all documents, take the last one
docs = list(yaml.safe_load_all(log_path.read_text()))
docs = [d for d in docs if d is not None]
if not docs:
    print("[!!] No runs found in telemetry log", file=sys.stderr)
    sys.exit(1)

run = docs[-1]

# Build compact record with schema version
record = {
    "schema_version": 1,
    "run_id": run.get("run_id", ""),
    "branch": run.get("branch", ""),
    "target": run.get("target", ""),
    "pr_type": run.get("pr_type", ""),
    "started": run.get("started", ""),
    "finished": run.get("finished", ""),
    "duration_seconds": run.get("duration_seconds", 0),
    "outcome": run.get("outcome", ""),
}
if run.get("pr_number"):
    record["pr_number"] = run["pr_number"]

# Compact step summaries: name, duration, outcome only
steps = run.get("steps", [])
if steps:
    record["step_count"] = len(steps)
    record["steps"] = [
        {
            "name": s.get("name", ""),
            "duration_seconds": s.get("duration_seconds", 0),
            "outcome": s.get("outcome", ""),
        }
        for s in steps
    ]

history_dir.mkdir(parents=True, exist_ok=True)

# Append as a new YAML document
with open(history_path, "a") as f:
    f.write("---" + chr(10))
    yaml.dump(record, f, default_flow_style=False, sort_keys=False)

print(f"[ok] Telemetry: run persisted to {history_path}")
PYINLINE
}
# --- Dispatch -----------------------------------------------------------------

COMMAND="${1:-}"
shift || true

case "$COMMAND" in
  start-run)  cmd_start_run "$@" ;;
  start-step) cmd_start_step "$@" ;;
  end-step)   cmd_end_step "$@" ;;
  end-run)    cmd_end_run "$@" ;;
  cancel-run)    cmd_cancel_run ;;
  persist-run) cmd_persist_run ;;
  *)
    echo "Usage: pr-telemetry.sh <command> [options]" >&2
    echo "" >&2
    echo "Commands:" >&2
    echo "  start-run   Begin a new PR workflow run" >&2
    echo "  start-step  Mark the start of a workflow step" >&2
    echo "  end-step    Mark the end of a workflow step with outcome" >&2
    echo "  end-run     Finalize the run and write to log" >&2
    echo "  cancel-run  Discard the current in-progress run" >&2
    echo "  persist-run Copy the latest run to version-controlled history" >&2
    exit 1
    ;;
esac

