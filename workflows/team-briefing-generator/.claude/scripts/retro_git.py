"""Shared git operations for retro analyzers.

Low-level git command execution and tree queries used across all
retro analyzer scripts.
"""

from __future__ import annotations

import subprocess
import sys


def git(args: list[str], repo_root: str, timeout: int = 30) -> str:
    """Run a git command and return stdout."""
    result = subprocess.run(
        ["git", "-C", repo_root, *args],
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        print(f"[--] git {args[0]} returned {result.returncode}", file=sys.stderr)
    return result.stdout.strip()


def git_check(args: list[str], repo_root: str) -> bool:
    """Run a git command and return True if exit code is 0."""
    result = subprocess.run(
        ["git", "-C", repo_root, *args],
        capture_output=True,
        text=True,
        timeout=10,
    )
    return result.returncode == 0


def file_exists_at_commit(repo_root: str, commit: str, path: str) -> bool:
    """Check if a file exists at a given commit."""
    return git_check(["cat-file", "-e", f"{commit}:{path}"], repo_root)


def line_count_at_commit(repo_root: str, commit: str, path: str) -> int:
    """Get line count of a file at a given commit."""
    try:
        content = git(["show", f"{commit}:{path}"], repo_root)
        if not content:
            return 0
        return len(content.split("\n"))
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError):
        return 0


def files_at_commit(repo_root: str, commit: str) -> set[str]:
    """List all files at a given commit."""
    output = git(["ls-tree", "-r", "--name-only", commit], repo_root, timeout=15)
    if not output:
        return set()
    return set(output.split("\n"))
