# Tiered Test Coverage

## 100% coverage means nothing if the tests are shallow

A project with 100% line coverage and only `assert result is not None` tests will ship bugs constantly. A project with 65% coverage where every test verifies a meaningful behavioral contract will ship fewer bugs than most 90% coverage projects. The number that matters is not "what percentage of lines executed" but "what percentage of behaviors are verified."

The problem with a single coverage target — say, 80% for the whole project — is that it treats your logging utility and your core scaffolding engine as equally important. Teams hit the target by padding coverage on easy modules and ignoring the hard ones. The scaffolding engine has 60% coverage with no edge case tests, the logging wrapper has 100%, and the project "passes" its coverage gate.

Tiered coverage solves this by asking: how much damage does a bug in this module cause? Modules that affect every user get strict requirements. Modules that generate badges get relaxed ones. The total coverage number becomes irrelevant — what matters is that each module is covered proportionally to its risk.

## The tiers

| Tier | Name | Basic Gate | Strict Gate | When to assign |
| --- | --- | --- | --- | --- |
| T1 | Critical Core | 90% | 95% | Every user depends on this module. Bugs produce incorrect output for everyone. High complexity, state mutation, subprocess calls. |
| T2 | Core Infrastructure | 80% | 90% | Many other modules import this. A failure cascades across features. |
| T3 | Important Features | 70% | 80% | Significant user-facing functionality. Bugs affect specific workflows but are containable. |
| T4 | Supporting Features | 65% | 75% | Enhances the system but failure is isolated. Read-only or cosmetic operations. |
| T5 | Peripheral | 60% | 70% | Simple, narrow scope, minimal state mutation, low complexity. |

New modules default to T5 until explicitly classified. This is intentional — an unclassified module should not silently inherit a high coverage requirement that nobody enforces.

## Classifying a module

Walk through these criteria top-to-bottom. The highest tier that applies wins:

1. **Mission criticality**: does every user depend on this module for the tool's core purpose? If scaffolding doesn't work, nothing works. That's T1.
2. **Dependency depth**: do 5+ other modules import it? A bug here cascades. T2.
3. **Failure impact**: does a bug cause data loss, security exposure, or silent corruption? The user doesn't get an error — they get wrong output. T1-T2.
4. **State mutation**: does it write to the filesystem, call subprocesses, or modify global state? Side effects are where the hardest bugs live. T1-T2.
5. **Complexity**: high cyclomatic complexity, many conditional paths? More paths means more places for bugs to hide. T1-T3.
6. **Containment**: if it fails, is the failure visible and recoverable? Can the user see the error and retry? T3-T4.
7. **Scope**: narrow, single-purpose, minimal risk? A utility function that formats strings. T5.

The common mistake is classifying by module size. A 50-line module that writes the final output file is T1. A 500-line module that generates optional documentation is T4. Size doesn't determine risk — blast radius does.

## Test value markers

Raw coverage counts lines executed. It doesn't distinguish between a test that verifies a critical behavioral contract and a test that imports a module and asserts `True`. Test value markers make this distinction explicit.

```python
@pytest.mark.test_value("essential")
def test_scaffold_creates_target_directory(tmp_path):
    """Scaffolding must create the output directory — without this, nothing works."""
    target = scaffold(metadata=META, output_dir=tmp_path / "out", skip_git=True)
    assert target.exists()
    assert target.is_dir()
```

| Level | When to use | Decision question |
| --- | --- | --- |
| `essential` | Tests a critical behavior whose absence would ship a bug. | "If this test were deleted, would we ship a bug?" |
| `thorough` | Meaningful edge case, error path, or integration point. | "Does this test a non-obvious failure mode?" |
| `defensive` | Regression test guarding against a specific past failure. | "Did this bug actually happen before?" |
| `structural` | Enforces project invariants (files exist, schemas valid). | "Is this verifying consistency, not behavior?" |

**Enforcement**: T1 modules require every test function to carry a marker. T2 modules require 75%. T3-T5 are advisory — markers are encouraged but not blocking.

Apply markers at whichever level makes sense: per-function for mixed files, per-class when all methods in a class share a purpose, or module-level via `pytestmark` for homogeneous test files.

## Anti-gaming detection

Coverage numbers invite gaming. These patterns are automatically detected and flagged as blocking for T1/T2 module test files:

**Assert-free tests** — a test function with no `assert` statement and no `pytest.raises`. It executes code but verifies nothing. Coverage goes up, confidence doesn't.

**Trivial identity tests** — the sole assertion is `assert result is not None` or `assert isinstance(result, SomeType)`. These verify the function returns something, not that it returns the right thing. A function that returns garbage passes both checks.

**Import-only tests** — imports a module and asserts `True`. This is coverage padding, not testing. Every line in the module's top-level scope gets marked as covered without testing a single behavior.

The detector is not trying to catch malice — it's catching the natural tendency to write the easiest test that moves the coverage number. When you find yourself writing `assert result is not None`, stop and ask: what specific value should `result` have, and what bug would a wrong value indicate?

## Quality-weighted scoring

The system computes a quality-weighted score that combines raw coverage with test quality annotations:

```text
weighted_score = raw_coverage * quality_weight
```

| Level | Weight |
| --- | --- |
| essential | 1.0 |
| thorough | 0.8 |
| defensive | 0.6 |
| structural | 0.4 |
| unclassified | 0.3 |

A module with 90% coverage but only unclassified tests scores **27%** (90 \* 0.3). A module with 80% coverage and all `essential` tests scores **80%** (80 \* 1.0). The message is clear: annotating your tests with meaningful purpose markers matters more than adding shallow tests to increase raw line coverage.

Quality-weighted scores are currently informational — they are reported but not enforced as gates. The trajectory is toward making them the primary metric.

## Practical commands

```bash
# Run tiered coverage check with basic gate
make tiered-coverage

# Run with strict gate
GATE=strict make tiered-coverage

# Manual: generate coverage JSON, then check tiers
pytest tests/ -v --cov=<package> --cov-report=json
python -m code_practices.coverage_tiers --check coverage.json --gate basic

# Include quality-weighted report
python -m code_practices.coverage_tiers --check coverage.json --gate basic --quality test_value_counts.json

# Run anti-gaming detection alone
pytest tests/test_test_quality.py::TestAntiGamingT1T2 -v

# Run marker enforcement alone
pytest tests/test_test_quality.py::TestTestValueMarkerEnforcement -v
```

Tier definitions and module assignments live in `src/<pkg>/coverage_tiers.py`. Update that file when adding a new module, promoting a module's importance, or adjusting thresholds.
