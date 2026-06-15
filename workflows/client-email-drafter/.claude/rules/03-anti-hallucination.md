# Derive, Never Assume

LLMs hallucinate when instructions are vague. Every derivable value must come from a command or file read, not from memory.

## Dates

Run `date +%Y-%m-%d` to get the current date. Never recall dates from memory — not for branch names, changelog entries, or commit messages.

## Versions

- Read the current version from `project-meta.yaml` or `pyproject.toml` before writing a new one.
- Read existing git tags (`git tag -l --sort=v:refname`) before choosing the next version.
- Never guess dependency versions — read `pyproject.toml` or `package.json`.

## File contents

- Read a file before modifying it. If many turns have passed since the last read, read it again.
- After writing structural formats (YAML, JSON, TOML), verify the result by reading it back.

## Paths

- Before referencing a path in a command, verify it exists (`ls` or `test -f`).
- Never guess nested directory structures — use `find` or `ls` to discover them.

## Configuration

- Read `project-meta.yaml` before making claims about language, phase, stage, category, or any metadata field.
- Read `pyproject.toml` before making claims about dependencies, constraints, or build config.

## Commands

- If a rule specifies a command, run that exact command. Do not substitute alternatives.
- If a script path is given (e.g., `.claude/scripts/stage-all-files.sh`), use it — do not inline the script's logic.

## After context compaction

When the conversation context is compressed, previously read file contents and tool outputs are no longer reliable. After compaction:

- Re-read any file you are about to modify — do not rely on summarized content.
- Re-derive dates, versions, and paths from their source commands.
- Do not trust variable values or state carried over in the summary — re-check them.
- If you are mid-way through a multi-file change, re-read all affected files before continuing.

## Verification

After multi-file changes that touch metadata, versions, or configuration:

- Run `bash .claude/scripts/validate-metadata-sync.sh` if the project has it.
- Read back any structural format (YAML, JSON, TOML) you just wrote to confirm it parses correctly.
- Run the test suite after modifying test files — do not assume edits are correct.
- After bumping a version, grep for the old version to catch any files you missed.
