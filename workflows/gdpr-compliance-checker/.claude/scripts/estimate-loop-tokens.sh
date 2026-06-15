#!/usr/bin/env bash
# estimate-loop-tokens.sh — Deterministic token budget calculator for Claude loops.
#
# Run on every Claude loop with more than one iteration. Prints a comparison
# table (regular Claude vs lean-claude.sh) and exits with a code that tells
# calling scripts what to do.
#
# Usage:
#   estimate-loop-tokens.sh --iterations N --input-tokens X --output-tokens Y [options]
#
# Required:
#   --iterations N       Number of loop passes
#   --input-tokens X     Estimated tokens in the per-iteration prompt payload
#   --output-tokens Y    Estimated tokens in the expected response per iteration
#
# Options:
#   --lean-ok            Caller has verified all three lean conditions are met
#   --autonomous         Skip the user prompt; auto-select and print decision to stderr
#   -h, --help           Show this help
#
# Exit codes:
#   0   Proceed with regular Claude (full project context)
#   2   Below 250 000 token threshold — proceed normally, no action needed
#   3   Above threshold but lean not available (--lean-ok not set)
#   5   Proceed with lean-claude.sh (minimal system prompt)
#
# Constants (from loop-token-budget.md):
#   Regular system tokens per call: ~36 000  (full CLAUDE.md + all rules)
#   Lean system tokens per call:    ~200     (custom system prompt only)
#   Threshold:                       250 000
#
# Examples:
#   estimate-loop-tokens.sh --iterations 40 --input-tokens 800 --output-tokens 150 --lean-ok
#   estimate-loop-tokens.sh --iterations 12 --input-tokens 500 --output-tokens 100 --lean-ok --autonomous

set -euo pipefail

# ── Constants ──────────────────────────────────────────────────────────────────
REGULAR_SYSTEM=36000
LEAN_SYSTEM=200
THRESHOLD=250000
SAVINGS_THRESHOLD_PCT=40  # autonomous mode: choose lean only if savings exceed this

# ── Argument parsing ───────────────────────────────────────────────────────────
ITERATIONS=""
INPUT_TOKENS=""
OUTPUT_TOKENS=""
LEAN_OK=0
AUTONOMOUS=0

usage() {
  grep '^#' "$0" | grep -v '#!/' | sed 's/^# \{0,1\}//'
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --iterations)    ITERATIONS="$2";    shift 2 ;;
    --input-tokens)  INPUT_TOKENS="$2";  shift 2 ;;
    --output-tokens) OUTPUT_TOKENS="$2"; shift 2 ;;
    --lean-ok)       LEAN_OK=1;          shift ;;
    --autonomous)    AUTONOMOUS=1;       shift ;;
    -h|--help)       usage ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# ── Validation ─────────────────────────────────────────────────────────────────
missing=()
[[ -z "$ITERATIONS" ]]    && missing+=("--iterations")
[[ -z "$INPUT_TOKENS" ]]  && missing+=("--input-tokens")
[[ -z "$OUTPUT_TOKENS" ]] && missing+=("--output-tokens")

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Error: missing required arguments: ${missing[*]}" >&2
  echo "Usage: estimate-loop-tokens.sh --iterations N --input-tokens X --output-tokens Y" >&2
  exit 1
fi

for var_name in ITERATIONS INPUT_TOKENS OUTPUT_TOKENS; do
  val="${!var_name}"
  if ! [[ "$val" =~ ^[0-9]+$ ]]; then
    echo "Error: $var_name must be a positive integer, got: $val" >&2
    exit 1
  fi
done

if [[ "$ITERATIONS" -eq 0 ]]; then
  echo "Error: --iterations must be > 0" >&2
  exit 1
fi

# ── Arithmetic (pure bash integer) ────────────────────────────────────────────
regular_per_iter=$(( REGULAR_SYSTEM + INPUT_TOKENS + OUTPUT_TOKENS ))
lean_per_iter=$(( LEAN_SYSTEM + INPUT_TOKENS + OUTPUT_TOKENS ))

regular_total=$(( ITERATIONS * regular_per_iter ))
lean_total=$(( ITERATIONS * lean_per_iter ))

# ── Threshold check ────────────────────────────────────────────────────────────
if [[ "$regular_total" -le "$THRESHOLD" ]]; then
  exit 2
fi

# Integer percentage: multiply first to preserve precision (only computed when above threshold)
savings=$(( regular_total - lean_total ))
savings_pct=$(( savings * 100 / regular_total ))

# ── Format helper: N -> "NNN 000" style readable number ───────────────────────
fmt() {
  local n="$1"
  if [[ "$n" -ge 1000000 ]]; then
    printf "%d %03d %03d" $(( n / 1000000 )) $(( (n % 1000000) / 1000 )) $(( n % 1000 ))
  elif [[ "$n" -ge 1000 ]]; then
    printf "%d %03d" $(( n / 1000 )) $(( n % 1000 ))
  else
    printf "%d" "$n"
  fi
}

# ── Build and print the comparison table ──────────────────────────────────────
print_table() {
  echo ""
  echo "Loop token estimate"
  echo "───────────────────────────────────────────────────────────────"
  printf "  Iterations:        %s\n"    "$ITERATIONS"
  printf "  Avg input/iter:    ~%s tokens\n"  "$(fmt "$INPUT_TOKENS")"
  printf "  Avg output/iter:   ~%s tokens\n"  "$(fmt "$OUTPUT_TOKENS")"
  echo ""
  printf "  %-18s  %-12s  %-14s  %s\n" "Approach" "System/iter" "Total tokens" "Notes"
  printf "  %-18s  %-12s  %-14s  %s\n" "──────────────────" "────────────" "──────────────" "──────────────────────────────"
  printf "  %-18s  ~%-11s  ~%-13s  %s\n" \
    "Regular Claude" \
    "$(fmt "$REGULAR_SYSTEM")" \
    "$(fmt "$regular_total")" \
    "Full project context each call"

  if [[ "$LEAN_OK" -eq 1 ]]; then
    printf "  %-18s  ~%-11s  ~%-13s  %s\n" \
      "lean-claude.sh" \
      "$(fmt "$LEAN_SYSTEM")" \
      "$(fmt "$lean_total")" \
      "Minimal system prompt, no rules"
    echo ""
    printf "  Savings with lean: ~%s tokens (~%d%%)\n" "$(fmt "$savings")" "$savings_pct"
  fi
  echo "───────────────────────────────────────────────────────────────"
}

# ── Autonomous mode ────────────────────────────────────────────────────────────
if [[ "$AUTONOMOUS" -eq 1 ]]; then
  if [[ "$LEAN_OK" -eq 1 ]] && [[ "$savings_pct" -gt "$SAVINGS_THRESHOLD_PCT" ]]; then
    echo "[loop-budget] Using lean — estimated ~$(fmt "$lean_total") tokens" >&2
    exit 5
  else
    echo "[loop-budget] Using regular — estimated ~$(fmt "$regular_total") tokens" >&2
    exit 0
  fi
fi

# ── Interactive mode ───────────────────────────────────────────────────────────
print_table

if [[ "$LEAN_OK" -ne 1 ]]; then
  echo ""
  echo "  (lean not available — lean conditions not verified via --lean-ok)"
  echo "───────────────────────────────────────────────────────────────"
  exit 3
fi

echo ""
while true; do
  printf "Which approach should I use? [regular / lean] (default: regular): "
  read -r answer || { echo "" >&2; echo "No input received — exiting. Use --autonomous in non-interactive contexts." >&2; exit 1; }
  answer_lower=$(echo "$answer" | tr "[:upper:]" "[:lower:]")
  case "$answer_lower" in
    lean|l)    exit 5 ;;
    regular|r|"") exit 0 ;;
    *)
      echo "Unrecognised answer '$answer'. Please type 'regular', 'lean', or press Enter for regular." >&2
      ;;
  esac
done
