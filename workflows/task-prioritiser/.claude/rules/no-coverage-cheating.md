# No Coverage Cheating

Never suggest lowering coverage thresholds, excluding files from coverage measurement, ignoring untested modules, or any other tactic that trades real test quality for a passing gate. The coverage requirements exist for a reason — meet them by writing tests, not by weakening the rules.

## Prohibited suggestions

- Lowering `--cov-fail-under` or the project's `coverage_target`
- Adding modules or files to coverage exclusion lists (`omit`, `exclude_lines`, `[tool.coverage.run].omit`)
- Marking lines or branches with `# pragma: no cover` to dodge the threshold (legitimate use for unreachable defensive code is fine — dodging the gate is not)
- Suggesting the user downgrade their quality gate (`strict` to `basic`, `basic` to `none`)
- Reducing tier assignments in `coverage_tiers.py` to lower the bar
- Skipping, deleting, or weakening existing tests to avoid failures
- Suggesting `--no-cov` or otherwise disabling coverage measurement
- Writing trivial or assert-free tests solely to inflate the coverage number (see anti-gaming rules in `test-coverage-tiers.md`)

## What to do instead

When coverage is below the threshold:

1. Identify which modules and functions are under-covered.
2. Write meaningful tests that exercise real behavior, edge cases, and error paths.
3. Prioritize tests by module tier — T1/T2 modules matter most.
4. If a module is genuinely untestable (e.g., thin CLI glue), discuss reclassifying its tier with the user — but never silently lower it.

Coverage gates are a floor, not a ceiling. The goal is well-tested software, not a green number.
