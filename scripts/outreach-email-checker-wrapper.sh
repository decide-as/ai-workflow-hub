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
    if [[ -n "${PUSHOVER_USER_KEY:-}" && -n "${PUSHOVER_API_TOKEN:-}" ]]; then
        curl -s \
            --form-string "token=${PUSHOVER_API_TOKEN}" \
            --form-string "user=${PUSHOVER_USER_KEY}" \
            --form-string "title=${title}" \
            --form-string "message=${message}" \
            "$PUSHOVER_API" > /dev/null 2>&1 || true
    fi
}

mkdir -p "$(dirname "$ERROR_LOG")"

if [[ ! -f "$SCRIPT" ]]; then
    msg="outreach-email-checker.py not found at $SCRIPT"
    echo "$msg" >> "$ERROR_LOG"
    send_pushover "Outreach Checker Error" "$msg"
    exit 1
fi

if "$PYTHON" "$SCRIPT" 2>> "$ERROR_LOG"; then
    exit 0
else
    exit_code=$?
    msg="outreach-email-checker.py exited with code $exit_code — check $ERROR_LOG"
    send_pushover "Outreach Checker Error" "$msg"
    exit "$exit_code"
fi
