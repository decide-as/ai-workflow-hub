# Meeting-Notes-Summariser

Converts raw meeting transcripts into structured summaries with decisions and action items

## Project structure

- `src/meeting_notes_summariser/` — Source code (src layout)
- `tests/` — Test suite
- `assets/` — Project assets
## Quick start

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev,test]"
make test
```

## Conventions

- Python >=3.11, virtual environment in `.venv/`
- `pyproject.toml` for dependencies and project metadata
- `pytest` for testing, `ruff` for linting/formatting
- See `.claude/rules/` for git commit, branching, and PR workflows
- See `.claude/conventions/` for python-tool coding standards
- See `ARCHITECTURE.md` for system design and component relationships

## Context compaction

When compacting, always preserve the full list of modified files, test commands, and any in-progress task state.
