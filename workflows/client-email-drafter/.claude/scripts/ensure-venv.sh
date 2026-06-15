#!/usr/bin/env bash
# ensure-venv.sh — Verify .venv exists and is functional, create if missing.
#
# Works in both main checkouts and worktrees. Idempotent — safe to run always.
#
# Usage: bash .claude/scripts/ensure-venv.sh
#
# Exit codes:
#   0 — venv is ready (already existed or just created)
#   1 — venv creation failed

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
venv_dir="${repo_root}/.venv"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Detect context: main checkout or worktree ---
git_path="${repo_root}/.git"
if [ -d "$git_path" ]; then
    context="main"
else
    context="worktree"
fi

# --- Quick check: venv exists and python is executable ---
if [ -x "${venv_dir}/bin/python" ]; then
    # Verify pip works (catches corrupted venvs)
    if "${venv_dir}/bin/python" -c "import pip" 2>/dev/null; then
        echo "[ok] .venv is functional (${context} checkout)"
        exit 0
    else
        echo "[!!] .venv exists but is broken — recreating"
        rm -rf "$venv_dir"
    fi
fi

# --- Create venv ---
echo "[--] Creating .venv in ${context} checkout: ${repo_root}"

if [ "$context" = "worktree" ] && [ -f "${script_dir}/setup-worktree-venv.sh" ]; then
    # Delegate to worktree-specific script (handles .pth verification, main checkout protection, permissions)
    bash "${script_dir}/setup-worktree-venv.sh"
else
    # Main checkout: find the best available Python >= 3.11.
    # Search strategy (first match wins within each group, highest version preferred):
    #   1. Versioned binaries in common locations and PATH (python3.14 down to python3.11)
    #   2. Homebrew versioned formulae (/opt/homebrew, /usr/local)
    #   3. pyenv shims (~/.pyenv/shims)
    #   4. asdf shims (~/.asdf/shims)
    #   5. Generic python3 in PATH (if >= 3.11)
    _check_py() {
        local cmd="$1"
        if command -v "$cmd" &>/dev/null; then
            local ver
            ver=$("$cmd" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
            local major=${ver%%.*}
            local minor=${ver#*.}
            if [ "${major:-0}" -ge 3 ] && [ "${minor:-0}" -ge 11 ]; then
                BEST_PY="$cmd"
                return 0
            fi
        fi
        return 1
    }

    BEST_PY=""
    # Search versioned binaries (highest first) across PATH and known locations
    for minor in 14 13 12 11; do
        _check_py "python3.${minor}" && break
        _check_py "/opt/homebrew/bin/python3.${minor}" && break
        _check_py "/usr/local/bin/python3.${minor}" && break
        _check_py "${HOME}/.pyenv/shims/python3.${minor}" && break
        _check_py "${HOME}/.asdf/shims/python3.${minor}" && break
    done
    # Fallback: generic python3 (may be 3.11+ on some systems)
    if [ -z "$BEST_PY" ]; then
        _check_py "/opt/homebrew/bin/python3" || \
        _check_py "/usr/local/bin/python3" || \
        _check_py python3 || true
    fi
    if [ -z "$BEST_PY" ]; then
        echo "[!!] No Python >= 3.11 found." >&2
        echo "     Install via: brew install python@3.14, pyenv install 3.14, or asdf install python 3.14" >&2
        exit 1
    fi
    echo "[--] Using $BEST_PY ($($BEST_PY --version 2>&1))"
    "$BEST_PY" -m venv "$venv_dir"
    echo "[--] Installing editable package with dev+test dependencies..."
    "${venv_dir}/bin/pip" install --quiet -e "${repo_root}[dev,test]"
    echo "[ok] .venv ready (${context} checkout)"
fi
