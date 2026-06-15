#!/usr/bin/env bash
# setup-worktree-venv.sh — Create an isolated .venv in a worktree so the
# editable install resolves to the worktree's source tree, not the main
# checkout's.
#
# Usage: bash .claude/scripts/setup-worktree-venv.sh
#
# Idempotent: skips venv creation if .venv/bin/python already exists and the
# editable install already points to the current directory's src/.

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
venv_dir="${repo_root}/.venv"
expected_src="${repo_root}/src"

# --- Guard: only useful inside a worktree ---
git_path="${repo_root}/.git"
if [ -d "$git_path" ]; then
    echo "[--] Not a worktree (main checkout). Nothing to do."
    exit 0
fi

# --- Check if venv already points to the right source ---
if [ -x "${venv_dir}/bin/python" ]; then
    current_pth=$(find "${venv_dir}" -name '__editable__.*-*.pth' 2>/dev/null | head -1)
    if [ -n "$current_pth" ] && grep -qx "$expected_src" "$current_pth" 2>/dev/null; then
        echo "[ok] .venv already configured for this worktree."
        # Still register worktree path (may be missing from registry)
        script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        if [ -f "${script_dir}/setup-worktree-permissions.sh" ]; then
            bash "${script_dir}/setup-worktree-permissions.sh"
        fi
        exit 0
    fi
fi

# --- Guard: warn if another venv is active ---
if [ -n "${VIRTUAL_ENV:-}" ] && [ "$VIRTUAL_ENV" != "$venv_dir" ]; then
    echo "[!!] WARNING: A different venv is active: ${VIRTUAL_ENV}"
    echo "     This script uses the worktree's own .venv/bin/pip, but if you"
    echo "     run bare 'pip install -e .' later, it will corrupt the active venv."
    echo "     Deactivate first or activate this worktree's venv after setup."
fi

# --- Create venv ---
echo "[--] Creating .venv in worktree: ${repo_root}"
# Find best available Python (prefer Homebrew over system)
BEST_PY=""
for candidate in /opt/homebrew/bin/python3.12 /opt/homebrew/bin/python3.11 /usr/local/bin/python3.12 /usr/local/bin/python3.11 /opt/homebrew/bin/python3 /usr/local/bin/python3 python3.12 python3.11 python3; do
    if command -v "$candidate" &>/dev/null; then
        ver=$("$candidate" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
        major=${ver%%.*}
        minor=${ver#*.}
        if [ "${major:-0}" -ge 3 ] && [ "${minor:-0}" -ge 11 ]; then
            BEST_PY="$candidate"
            break
        fi
    fi
done
if [ -z "$BEST_PY" ]; then
    echo "[!!] No Python >= 3.11 found." >&2
    exit 1
fi
echo "[--] Using $BEST_PY ($($BEST_PY --version 2>&1))"
"$BEST_PY" -m venv "$venv_dir"

# --- Install editable with dev+test deps ---
echo "[--] Installing editable package with dev+test dependencies..."
"${venv_dir}/bin/pip" install --quiet -e "${repo_root}[dev,test]"

# --- Verify worktree's own install ---
installed_pth=$(find "${venv_dir}" -name '__editable__.*-*.pth' 2>/dev/null | head -1)
if [ -n "$installed_pth" ] && grep -qx "$expected_src" "$installed_pth" 2>/dev/null; then
    echo "[ok] Editable install points to: ${expected_src}"
else
    echo "[!!] WARNING: Could not verify editable install path."
    echo "     Expected: ${expected_src}"
    [ -n "$installed_pth" ] && echo "     Got: $(cat "$installed_pth")"
    exit 1
fi

# --- Verify main checkout was not corrupted ---
main_checkout="$(git rev-parse --git-common-dir 2>/dev/null | sed 's|/\.git$||')" || true
if [ -n "$main_checkout" ] && [ "$main_checkout" != "$repo_root" ]; then
    main_venv="${main_checkout}/.venv"
    if [ -d "$main_venv" ]; then
        main_pth=$(find "$main_venv" -name '__editable__.*-*.pth' 2>/dev/null | head -1)
        if [ -n "$main_pth" ]; then
            main_pth_content=$(cat "$main_pth" 2>/dev/null)
            main_expected="${main_checkout}/src"
            if [ "$main_pth_content" != "$main_expected" ]; then
                echo "[!!] Main checkout venv was corrupted! Fixing..."
                echo "     ${main_pth} pointed to: ${main_pth_content}"
                echo "     Restoring to: ${main_expected}"
                "${main_venv}/bin/pip" install --quiet -e "${main_checkout}[dev,test]"
                echo "[ok] Main checkout venv restored."
            fi
        fi
    fi
fi

# --- Register worktree for auto-approval ---
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${script_dir}/setup-worktree-permissions.sh" ]; then
    bash "${script_dir}/setup-worktree-permissions.sh"
fi

echo "[ok] Worktree venv ready. Activate with: source ${venv_dir}/bin/activate"
