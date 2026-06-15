# Test Paradigm

This document classifies every test in the Team-Briefing-Generator test suite by category, provides counts, and identifies gaps. Tests are also marked with `@pytest.mark.<category>` decorators that enable running subsets via `pytest -m <marker>`.

## Categories

| Marker | Category | Description |
|--------|----------|-------------|
| `unit` | Unit | Pure function tests with no filesystem or subprocess dependencies |
| `integration` | Integration | Tests requiring filesystem fixtures or multi-module interaction |
| `e2e` | CLI / E2E | Full CLI invocation via `CliRunner` or API layer |
| `edge_case` | Edge Case | Boundary conditions, unusual inputs, empty/missing data |
| `error_handling` | Error Handling | Graceful degradation, failed subprocesses, timeouts |
| `security` | Security | Permission patterns, secret detection, access control |
| `config` | Configuration | Schema validation, settings, config loading |
| `smoke` | Smoke | Basic import and health checks |
| `quality` | Quality | Code quality and structural checks |
| `structure` | Structure | Project structure and consistency checks |

## Running by marker

```bash
pytest tests/ -m unit                # Fast unit tests only
pytest tests/ -m e2e                 # CLI end-to-end tests
pytest tests/ -m security            # Security tests
pytest tests/ -m "not e2e"           # Everything except CLI tests
pytest tests/ -m "unit or config"    # Combine markers
pytest tests/ -m quality             # Code quality checks only
pytest tests/ -m structure           # Project structure checks only
```

## Updating counts

Counts in this document are generated automatically. Run:

```bash
make test-paradigm                              # or:
python scripts/test_paradigm_counts.py --update
```

## Summary

| Category | Count | % of total |
|----------|------:|:----------:|
| Smoke | 1 | — |
| Quality | — | — |
| Structure | — | — |

Tests may carry up to 2 markers, so totals may exceed the total test count.

## Gaps

| Gap | Risk | Recommendation |
|-----|------|----------------|
| No unit tests beyond smoke | High | Add tests for each source module |
| No integration tests | Medium | Test multi-module interactions |
| No edge case tests | Medium | Test boundary conditions and invalid inputs |
| No error handling tests | Medium | Test graceful degradation paths |
