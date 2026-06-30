#!/usr/bin/env bash
# Wrapper for outreach-email-checker.py — runs the checker and sends a Pushover
# notification if it exits with a non-zero status or the script file is missing.

set -euo pipefail

SCRIPT="/Users/christianbraathen/Repositories/workflow-hub/scripts/outreach-email-checker.py"
PYTHON="/opt/homebrew/bin/python3"
ENV_FILE="/Users/christianbraathen/Repositories/workflow-hub/.env"
ERROR_LOG="/Users/christianbraathen/Repositories/workflow-hub/logs/outreach-email-checker-error.log"
PUSHOVER_API="https://api.pushover.net/1/messages.json"

# Load .env for Pushover credentials
if [[ -f "$ENV_FILE" ]]; then
    while IFS= read -r line; do
        [[ -z "$line" || "$line" == \#* ]] && continue
        [[ "$line" != *=* ]] && continue
        key="${line%%=*}"
        val="${line#*=}"
        val="${val%\"}"
        val="${val#\"}"
        val="${val%\'}"
        val="${val#\'}"
        export "$key=$val"
    done < "$ENV_FILE"
fi

send_pushover() {
    local title="$1"
    local message="$2"
    local token="${PUSHOVER_APP:-}"
    local user="${PUSHOVER_USER:-}"

    [[ -z "$token" || -z "$user" ]] && return 0

    curl -s \
        --form-string "token=$token" \
        --form-string "user=$user" \
        --form-string "title=$title" \
        --form-string "message=$message" \
        --form-string "priority=0" \
        "$PUSHOVER_API" > /dev/null
}

mkdir -p "$(dirname "$ERROR_LOG")"

# Check the script exists before trying to run it
if [[ ! -f "$SCRIPT" ]]; then
    send_pushover \
        "outreach-checker: script missing" \
        "Script not found: $SCRIPT\n\nThe scheduled job cannot run until the file is restored."
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] Script not found: $SCRIPT" >&2
    exit 1
fi

# Run the checker, capturing exit code
set +e
"$PYTHON" "$SCRIPT" 2>> "$ERROR_LOG"
EXIT_CODE=$?
set -e

if [[ $EXIT_CODE -ne 0 ]]; then
    # Embed the last 10 lines of stderr for context
    TAIL=""
    if [[ -f "$ERROR_LOG" ]]; then
        TAIL=$(tail -10 "$ERROR_LOG" 2>/dev/null || true)
    fi

    send_pushover \
        "outreach-checker: run failed (exit $EXIT_CODE)" \
        "Exit code: $EXIT_CODE\n\nLast stderr:\n$TAIL"

    exit $EXIT_CODE
fi
