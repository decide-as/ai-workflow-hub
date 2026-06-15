# Python Coding Conventions

## Style

- Follow PEP 8 with a line length of 99 characters
- Use `ruff` for linting and formatting
- Prefer f-strings over `.format()` or `%` formatting
- Use type hints for function signatures

## Type checking

- Use `mypy` for static type analysis
- All function signatures must have type annotations (parameters and return types)
- Use `from __future__ import annotations` for forward-reference support
- At `basic` quality gate: mypy runs with relaxed settings (untyped defs allowed)
- At `strict` quality gate: mypy runs with `--strict` flag
- Add type stub packages (e.g., `types-PyYAML`) to dev dependencies when needed
- Prefer precise types over `Any` — use `Any` only as a last resort
- Run `make typecheck` before committing

## Architecture

- **Entry points**: `app/` package for application code, `lib/` for shared infrastructure
- **Config**: Pydantic `BaseSettings` or dataclass-based configuration
- **Async**: Use `asyncio` when I/O-bound; keep sync for CPU-bound
- **Models**: Dataclasses or Pydantic models for structured data

## Naming

- snake_case for functions, variables, modules
- PascalCase for classes
- UPPER_SNAKE_CASE for constants
- Private helpers prefixed with underscore

## Testing

- Use `pytest` as the test framework
- Test files mirror source structure: `tests/test_<module>.py`
- Use fixtures in `conftest.py` for shared setup
- Prefer parametrized tests for multiple input scenarios

## Packaging

- `pyproject.toml` for all project metadata (no `setup.py`)
- Virtual environments via `python3 -m venv .venv`
- Pin direct dependencies with minimum versions in `pyproject.toml`
