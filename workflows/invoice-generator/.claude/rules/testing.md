# Testing Rules

## Test structure

- Place all tests in `tests/` at the project root.
- Mirror the source directory structure in test files (e.g., `src/pkg/models.py` → `tests/test_models.py`).
- Use `conftest.py` for shared fixtures scoped to directories.
- Every new source module must have a corresponding test file — `test_code_quality.py` enforces this automatically.

## Writing tests

- Every public function or method should have at least one test.
- Name test functions `test_<what_it_does>`, not `test_<function_name>`.
- Keep tests focused — one assertion per logical check.
- Use parametrize for testing multiple inputs with the same logic.
- Prefer real objects over mocks. Mock only external services (APIs, databases, filesystems).
- Include the "why" in assertions: `assert result == expected, "slugify should lowercase"`.

## Test classification (markers)

Every test must carry at least one pytest marker. The project registers these markers:

| Marker | When to use |
| --- | --- |
| `unit` | Pure function tests — no filesystem, no subprocess, no network |
| `integration` | Requires filesystem fixtures, database, or multi-module interaction |
| `e2e` | Full CLI invocation or API round-trip |
| `edge_case` | Boundary conditions, unusual inputs, empty/missing data |
| `error_handling` | Graceful degradation, failed subprocesses, timeouts |
| `security` | Permission patterns, secret detection, access control |
| `config` | Configuration loading, schema validation, settings |
| `smoke` | Basic import and health checks |
| `quality` | AST-based code quality checks (docstrings, no-print, no-secrets) |
| `test_value` | Test quality/purpose annotation (essential, thorough, defensive, structural) |
| `structure` | Project structure and metadata consistency |

Apply markers at the module level (`pytestmark = pytest.mark.unit`) for homogeneous files, or per-function/per-class for mixed files.

The `conftest.py` auto-tagger infers markers from file names (e.g., `test_code_quality.py` → `quality`). Override with explicit markers when the inference is wrong.

## Quality-first testing

Prioritize writing thoughtful, high-quality tests over chasing coverage numbers. Test behavior and contracts, not implementation details. Each test should have a clear reason to exist — if you cannot explain what bug it would catch, reconsider.

Use `@pytest.mark.test_value("<level>")` to annotate why a test exists: `essential`, `thorough`, `defensive`, or `structural`. See `test-coverage-tiers.md` for full definitions.

### Classification threshold

At least 97% of all tests must have a `test_value` marker. When writing or reviewing tests, always classify them. Only leave a test unclassified when you cannot confidently determine its purpose from the test name, class context, and a quick read of the body. If your confidence is medium-high, classify it — a reasonable label is better than unclassified.

Per-module coverage requirements are enforced by tier. See `test-coverage-tiers.md` for tier definitions and module assignments.

## Running tests

- Run the full test suite before committing: `pytest tests/ -v`.
- Run subsets by marker: `pytest tests/ -m unit` for fast feedback.
- Fix failing tests before moving to new work.
- Never disable or skip tests without a comment explaining why.

## Test paradigm document

Maintain `tests/TEST_PARADIGM.md` as the living index of test counts and gaps. Update it after adding or removing tests:

```bash
make test-paradigm
```

The paradigm document tracks:
- Per-marker counts and percentages.
- Per-file breakdown with primary markers.
- Identified testing gaps with risk levels and recommendations.

## Structural tests

The project ships with automated structural tests that enforce consistency:

- **test_code_quality.py**: AST-based docstring enforcement, no `print()` in source, no hardcoded secrets, every module has a test file. Scales with quality gate (basic adds checks, strict adds TODO/FIXME enforcement).
- **test_structure.py**: Verifies required files exist, metadata is valid, versions match across `project-meta.yaml`/`pyproject.toml`/`CHANGELOG.md`, README has required sections.

These tests run as part of the normal test suite and are the first line of defence against drift.

## Coverage

- Aim for meaningful coverage, not 100%. Cover edge cases and error paths.
- Do not write tests for trivial getters, setters, or framework boilerplate.
- When the project quality gate is `basic` or `strict`, run tests with coverage before committing:

```bash
pytest tests/ -v --cov=<package> --cov-report=term-missing
```

- Coverage targets by quality gate:
  - `basic`: ≥ 60% (or the project's `coverage_target` in `project-meta.yaml`)
  - `strict`: ≥ 80% (or the project's `coverage_target` in `project-meta.yaml`)
- Use `--cov-fail-under=<target>` in CI to enforce the minimum.
