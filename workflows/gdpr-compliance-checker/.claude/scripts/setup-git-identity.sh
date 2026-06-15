#!/usr/bin/env bash
# setup-git-identity.sh — Configure per-repo git SSH identity.
#
# Reads github_account from project-meta.yaml, looks up the SSH host alias
# and identity file from ~/.config/code-practices/accounts.yaml (the account
# map built by discover-ssh-accounts.sh), and sets:
#   - git config core.sshCommand (routes git ops through the correct key)
#   - git remote set-url origin   (rewrites hostname to the SSH alias)
#
# Falls back to ssh_host from project-meta.yaml if the account map has no
# entry for the configured account.
#
# Idempotent: re-running when already configured is a no-op.
#
# Usage:
#   bash .claude/scripts/setup-git-identity.sh          # configure
#   bash .claude/scripts/setup-git-identity.sh --verify # configure + test SSH
#   bash .claude/scripts/setup-git-identity.sh --status # show current state
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
META_FILE="project-meta.yaml"
ACCOUNT_MAP="${HOME}/.config/code-practices/accounts.yaml"
VERIFY=false
STATUS_ONLY=false

for arg in "$@"; do
    case "$arg" in
        --verify)   VERIFY=true ;;
        --status)   STATUS_ONLY=true ;;
    esac
done

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_read_meta() {
    local field="$1"
    local raw
    raw=$(bash "$SCRIPT_DIR/read-project-meta.sh" "$field" 2>/dev/null || echo "")
    # read-project-meta.sh outputs "field=value"; strip the prefix
    echo "${raw#*=}"
}

_read_yaml_field() {
    # Minimal POSIX YAML reader: extracts a scalar value from a simple
    # two-level structure: accounts.<username>.<field>
    local file="$1"
    local username="$2"
    local field="$3"
    # Find the username block, then look for field within the next few lines
    awk -v user="$username" -v fld="$field" '
        /^  [a-zA-Z0-9_-]+:/ { in_user = ($0 ~ "^  " user ":") }
        in_user && $0 ~ "^    " fld ":" {
            sub(/^    [^:]+:[[:space:]]*/, "")
            print
            exit
        }
    ' "$file"
}

# ---------------------------------------------------------------------------
# --status mode
# ---------------------------------------------------------------------------

if [[ "$STATUS_ONLY" == "true" ]]; then
    echo "=== Git Identity Status ==="
    echo "  core.sshCommand : $(git config core.sshCommand 2>/dev/null || echo '(not set)')"
    echo "  origin URL      : $(git remote get-url origin 2>/dev/null || echo '(no remote)')"
    echo "  github_account  : $(_read_meta github_account || echo '(not set)')"
    echo "  ssh_host        : $(_read_meta ssh_host || echo '(not set)')"
    echo "  account map     : ${ACCOUNT_MAP}"
    [[ -f "$ACCOUNT_MAP" ]] && echo "  map exists      : yes" || echo "  map exists      : no"
    exit 0
fi

# ---------------------------------------------------------------------------
# Resolve account
# ---------------------------------------------------------------------------

if [[ ! -f "$META_FILE" ]]; then
    # Not a code-practices project — nothing to do
    exit 0
fi

ACCOUNT=$(_read_meta github_account)

if [[ -z "$ACCOUNT" ]]; then
    # No account configured — nothing to do
    exit 0
fi

# ---------------------------------------------------------------------------
# Resolve SSH host + identity file
# ---------------------------------------------------------------------------

SSH_HOST=""
IDENTITY_FILE=""

# Primary: account map
if [[ -f "$ACCOUNT_MAP" ]]; then
    SSH_HOST=$(_read_yaml_field "$ACCOUNT_MAP" "$ACCOUNT" "ssh_host")
    IDENTITY_FILE=$(_read_yaml_field "$ACCOUNT_MAP" "$ACCOUNT" "identity_file")
fi

# Fallback: explicit ssh_host in project-meta.yaml
if [[ -z "$SSH_HOST" ]]; then
    SSH_HOST=$(_read_meta ssh_host)
    if [[ -n "$SSH_HOST" ]]; then
        # Derive identity_file from ~/.ssh/config Host block
        IDENTITY_FILE=$(awk -v host="$SSH_HOST" '
            /^[Hh]ost[[:space:]]/ { in_block = ($2 == host) }
            in_block && /[Ii]dentity[Ff]ile/ { print $2; exit }
        ' "${HOME}/.ssh/config" 2>/dev/null || echo "")
    fi
fi

if [[ -z "$SSH_HOST" ]]; then
    if [[ ! -f "$ACCOUNT_MAP" ]]; then
        echo "[warn] No account map found. Run: bash .claude/scripts/discover-ssh-accounts.sh" >&2
    else
        echo "[warn] Account '${ACCOUNT}' not found in account map and no ssh_host override set." >&2
        echo "       Re-run discover-ssh-accounts.sh or add ssh_host to project-meta.yaml." >&2
    fi
    exit 0
fi

if [[ -z "$IDENTITY_FILE" ]]; then
    echo "[warn] Could not determine identity file for account '${ACCOUNT}' / host '${SSH_HOST}'." >&2
    exit 0
fi

# Validate values are sane (no spaces, no shell metacharacters)
if ! [[ "$SSH_HOST" =~ ^[a-zA-Z0-9._-]+$ ]]; then
    echo "[!!] Invalid ssh_host value: '${SSH_HOST}'" >&2
    exit 1
fi

# Expand ~ in identity file path
IDENTITY_FILE_EXPANDED="${IDENTITY_FILE/#\~/$HOME}"

if [[ ! -f "$IDENTITY_FILE_EXPANDED" ]]; then
    echo "[warn] Identity file not found: ${IDENTITY_FILE_EXPANDED}" >&2
    echo "       Copy your SSH key to this path or run discover-ssh-accounts.sh again." >&2
    exit 0
fi

# ---------------------------------------------------------------------------
# Parse current origin URL to extract org/repo path
# ---------------------------------------------------------------------------

CURRENT_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [[ -z "$CURRENT_URL" ]]; then
    echo "[!!] No 'origin' remote found. Add a remote first." >&2
    exit 1
fi

# Support both git@host:org/repo.git and git@host:org/repo (no .git suffix)
if [[ "$CURRENT_URL" =~ ^git@[^:]+:(.+)$ ]]; then
    ORG_REPO="${BASH_REMATCH[1]}"
else
    echo "[!!] origin URL is not an SSH remote: ${CURRENT_URL}" >&2
    echo "     Only SSH remotes are supported (git@<host>:<org>/<repo>.git)." >&2
    exit 1
fi

NEW_URL="git@${SSH_HOST}:${ORG_REPO}"
NEW_CMD="ssh -i ${IDENTITY_FILE} -o IdentitiesOnly=yes"

# ---------------------------------------------------------------------------
# Apply — idempotent
# ---------------------------------------------------------------------------

CURRENT_CMD=$(git config core.sshCommand 2>/dev/null || echo "")

if [[ "$CURRENT_CMD" == "$NEW_CMD" && "$CURRENT_URL" == "$NEW_URL" ]]; then
    echo "[ok] Identity already correct (${ACCOUNT} → ${SSH_HOST})"
    exit 0
fi

if [[ "$CURRENT_URL" != "$NEW_URL" ]]; then
    echo "[--] Rewriting origin URL:"
    echo "     old: ${CURRENT_URL}"
    echo "     new: ${NEW_URL}"
    git remote set-url origin "$NEW_URL"
fi

if [[ "$CURRENT_CMD" != "$NEW_CMD" ]]; then
    git config core.sshCommand "$NEW_CMD"
fi

echo "[ok] Identity configured: ${ACCOUNT} → ${SSH_HOST} (${IDENTITY_FILE})"

# ---------------------------------------------------------------------------
# Optional SSH verification
# ---------------------------------------------------------------------------

if [[ "$VERIFY" == "true" ]]; then
    echo "[--] Verifying SSH connection to ${SSH_HOST}..."
    output=$(ssh \
        -T \
        -o ConnectTimeout=5 \
        -o BatchMode=yes \
        -o StrictHostKeyChecking=accept-new \
        "$SSH_HOST" 2>&1 || true)

    if [[ "$output" =~ Hi[[:space:]]+([a-zA-Z0-9_-]+)! ]]; then
        verified_user="${BASH_REMATCH[1]}"
        if [[ "$verified_user" == "$ACCOUNT" ]]; then
            echo "[ok] SSH verified: authenticated as ${verified_user}"
        else
            echo "[warn] SSH connected but authenticated as '${verified_user}' (expected '${ACCOUNT}')" >&2
        fi
    else
        echo "[warn] SSH verification failed. Response: ${output}" >&2
        echo "       The git config was still written — the SSH failure may be transient." >&2
    fi
fi
