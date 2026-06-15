# Quality Gates

Quality gates define the minimum standards enforced in CI and during code review. The gate level determines which checks must pass before merging.

## Gate levels

| Gate | What it enforces |
|---|---|
| `none` | No automated enforcement. Tests and linting are recommended but not required. |
| `basic` | Linting must pass. Type checking (mypy) must pass. All tests must pass. Test coverage must meet the configured target (default 60%). |
| `strict` | Everything in basic, plus: mypy --strict, coverage target defaults to 80%, dependency audit (`pip-audit`) must be clean, static security analysis (`bandit`) must pass. |

## Phase-to-gate derivation

When `quality_gate` is not explicitly set in `project-meta.yaml`, it is derived from the project phase:

| Phases | Default gate |
|---|---|
| discovery, poc, prototype | `none` |
| mvp, alpha | `basic` |
| beta, pilot, validation, production | `strict` |

You can always override by setting `quality_gate` explicitly in `project-meta.yaml`.

## What each gate checks

### None

- Tests should exist and pass (not enforced in CI)
- Linting is recommended

### Basic

- `ruff check` and `ruff format --check` must pass (Python)
- `mypy src/<pkg>/` must pass
- `pytest tests/` must pass
- `pytest --cov=<pkg> --cov-fail-under=<target>` must pass
- `pip-audit` should be clean (warning, not blocking)

### Strict

- Everything in basic (all blocking)
- `mypy src/<pkg>/ --strict` must pass (supersedes basic mypy)
- `pip-audit` must be clean (blocking)
- `bandit -r <pkg>/ -q` must pass
- Coverage target is 80% unless explicitly set higher
- No `TODO` or `FIXME` in production code paths (advisory)

## Running quality checks locally

```bash
make lint        # Lint check
make typecheck   # Type checking
make test        # Run tests
make coverage    # Run tests with coverage
make security    # Dependency audit + security scan (strict only)
make quality     # All of the above
```

## ISO 25010 mapping (informational)

The quality gates operationalize key ISO/IEC 25010 software quality characteristics:

| ISO 25010 characteristic | What the gate measures | Gate level |
|---|---|---|
| Functional suitability | Test pass rate, test coverage | basic |
| Reliability | Edge case tests, error handling coverage | basic |
| Security | Dependency vulnerabilities, static analysis | strict |
| Maintainability | Lint compliance, code complexity, test coverage | basic |
| Performance efficiency | (future: benchmark tests) | — |

This mapping is informational. The gates enforce the engineering practices; the ISO model provides the conceptual framework.
