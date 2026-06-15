"""Programmatic ceiling for the scenario_breadth TQS dimension.

Uses AST analysis to compute a structural ceiling (0–4) that caps the LLM's
scenario_breadth score. The LLM may score at or below the ceiling; it cannot
exceed it. This prevents the LLM from being fooled by tests that look
sophisticated but lack structural substance.

Ceiling rules
─────────────
0  All assertions are trivially satisfiable — zero behavioral verification.
   (assert True, assert x is not None, assert isinstance(x, T) as sole assertion,
   assert len(x) >= 0)

1  ≥1 non-trivial assertion, single scenario, no error/negative coverage.

2  ≥2 non-trivial assertions with ≥2 distinct scenarios (via parametrize or inline),
   OR single scenario with multiple non-trivial assertions; no error path required.
   Also ceiling when error path exists but only 1 non-trivial assertion.

3  Has negative/error coverage (pytest.raises, assert_not_called, not-in assertion,
   negative parametrize expected values) AND (≥2 non-trivial OR ≥2 parametrize cases).

4  Large parametrize (≥4 cases) with ≥3 non-trivial assertions, OR ≥4 non-trivial
   assertions with error/negative coverage — structurally supports a full contract test.

LLM judges qualitative content within [0, ceiling]. It may score lower if:
- Parametrize cases are not meaningfully distinct.
- pytest.raises tests a contrived exception that never fires.
- Assertions are redundant or don't constrain plausible wrong outputs.
"""

from __future__ import annotations

import ast
from typing import Any

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_MOCK_ASSERT_METHODS: frozenset[str] = frozenset(
    {
        "assert_called",
        "assert_called_once",
        "assert_called_with",
        "assert_called_once_with",
        "assert_not_called",
        "assert_any_call",
        "assert_has_calls",
    }
)

_FALSY_CONSTANTS: tuple[object, ...] = (False, None, 0, "")


def _int_value(node: ast.expr) -> int | None:
    """Return the integer value of a literal or unary-negated literal, or None."""
    if isinstance(node, ast.Constant) and isinstance(node.value, int):
        return node.value
    # -1 is represented as UnaryOp(USub, Constant(1)) in the AST
    if (
        isinstance(node, ast.UnaryOp)
        and isinstance(node.op, ast.USub)
        and isinstance(node.operand, ast.Constant)
        and isinstance(node.operand.value, int)
    ):
        return -node.operand.value
    return None


# ---------------------------------------------------------------------------
# Trivial assertion classifier
# ---------------------------------------------------------------------------


def is_trivial_assertion(node: ast.Assert) -> bool:
    """Return True if the assertion is trivially satisfiable regardless of code behavior.

    Trivial patterns:
    - assert True / assert False  (literal constant)
    - assert result is not None / assert x is None  (identity with None)
    - assert isinstance(x, T)  (type-only check as the sole expression)
    - assert len(x) >= 0 / assert len(x) > -1  (always true for any sequence)
    """
    test = node.test

    # assert True / assert False / assert 0 / assert ""
    if isinstance(test, ast.Constant):
        return True

    # assert result is not None / assert x is None
    if isinstance(test, ast.Compare) and len(test.ops) == 1 and isinstance(test.ops[0], (ast.Is, ast.IsNot)):
        if len(test.comparators) == 1 and isinstance(test.comparators[0], ast.Constant):
            if test.comparators[0].value is None:
                return True

    # assert isinstance(x, T) — type check only, tells us nothing about value
    if isinstance(test, ast.Call):
        func = test.func
        if isinstance(func, ast.Name) and func.id == "isinstance":
            return True
        if isinstance(func, ast.Attribute) and func.attr == "isinstance":
            return True

    # assert len(x) >= 0 / assert len(x) > -1  (trivially true for any sequence)
    if isinstance(test, ast.Compare) and len(test.ops) == 1:
        if isinstance(test.ops[0], (ast.GtE, ast.Gt)) and isinstance(test.left, ast.Call):
            left_func = test.left.func
            is_len_call = (isinstance(left_func, ast.Name) and left_func.id == "len") or (
                isinstance(left_func, ast.Attribute) and left_func.attr == "len"
            )
            if is_len_call and len(test.comparators) == 1:
                threshold = _int_value(test.comparators[0])
                if threshold is not None:
                    if isinstance(test.ops[0], ast.GtE) and threshold <= 0:
                        return True
                    if isinstance(test.ops[0], ast.Gt) and threshold < 0:
                        return True

    return False


# ---------------------------------------------------------------------------
# Non-trivial assertion counter
# ---------------------------------------------------------------------------


def count_non_trivial_assertions(func: ast.FunctionDef) -> int:
    """Count assertions that provide specific behavioral verification.

    Counts:
    - ast.Assert nodes that are not trivially satisfiable.
    - Mock assertion method calls (assert_not_called, assert_called_with, etc.).
    """
    count = 0
    for node in ast.walk(func):
        if isinstance(node, ast.Assert):
            if not is_trivial_assertion(node):
                count += 1
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr in _MOCK_ASSERT_METHODS:
                count += 1
    return count


def count_error_path_assertions(func: ast.FunctionDef) -> int:
    """Count explicit error-path checks: with pytest.raises(...) blocks.

    These are structurally distinct from non-trivial assertions (they don't
    appear as ast.Assert nodes) but provide genuine behavioral verification.
    Counted separately so the ceiling logic can add them to the total.
    """
    count = 0
    for node in ast.walk(func):
        if isinstance(node, ast.With):
            for item in node.items:
                if isinstance(item.context_expr, ast.Call) and _is_pytest_raises(item.context_expr):
                    count += 1
    return count


# ---------------------------------------------------------------------------
# Parametrize case counter
# ---------------------------------------------------------------------------


def count_parametrize_cases(func: ast.FunctionDef) -> int:
    """Count total parametrize combinations from @pytest.mark.parametrize decorators.

    Handles stacked decorators by multiplying case counts (cartesian product).
    Returns 1 when no parametrize decorators are present (single-scenario test).
    """
    total = 1
    found = False
    for decorator in func.decorator_list:
        n = _extract_parametrize_case_count(decorator)
        if n is not None:
            total *= n
            found = True
    return total if found else 1


def _extract_parametrize_case_count(decorator: ast.expr) -> int | None:
    """Return the number of cases in a parametrize decorator, or None if not parametrize."""
    if not isinstance(decorator, ast.Call):
        return None
    func = decorator.func
    is_parametrize = isinstance(func, ast.Attribute) and func.attr == "parametrize"
    if not is_parametrize:
        return None
    if len(decorator.args) < 2:
        return None
    cases_arg = decorator.args[1]
    if isinstance(cases_arg, (ast.List, ast.Tuple)):
        return max(1, len(cases_arg.elts))
    return None


# ---------------------------------------------------------------------------
# Negative / error coverage detector
# ---------------------------------------------------------------------------


def has_negative_coverage(func: ast.FunctionDef) -> bool:
    """Return True if the test verifies negative, error, or boundary behavior.

    Detects any of:
    - pytest.raises(...) call or context manager
    - Mock assert_not_called() (proves a code path was NOT taken)
    - Negative assertions: assert x not in y, assert x != y, assert not x,
      assert x == False, assert x is False
    - Parametrize cases that include False/None/0/""/[] as argument values
      (indicating the test exercises falsy/empty/zero boundary inputs)
    """
    for node in ast.walk(func):
        # pytest.raises(...) — standalone call or context manager
        if isinstance(node, ast.Call) and _is_pytest_raises(node):
            return True

        # with pytest.raises(...) as exc: — explicit context manager
        if isinstance(node, ast.With):
            for item in node.items:
                if isinstance(item.context_expr, ast.Call) and _is_pytest_raises(item.context_expr):
                    return True

        # mock.assert_not_called() — proves a side-effect was suppressed
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr == "assert_not_called":
                return True

        # Negative assertions in assert statements
        if isinstance(node, ast.Assert) and _is_negative_assertion(node.test):
            return True

    # Parametrize cases that include falsy sentinel values
    return bool(_parametrize_has_negative_values(func))


def _is_pytest_raises(node: ast.Call) -> bool:
    """Return True if the call is pytest.raises(...)."""
    func = node.func
    if isinstance(func, ast.Attribute) and func.attr == "raises":
        return True
    return bool(isinstance(func, ast.Name) and func.id == "raises")


def _is_negative_assertion(test: ast.expr) -> bool:
    """Return True if the assertion checks that something is absent, wrong, or False."""
    # assert not x
    if isinstance(test, ast.UnaryOp) and isinstance(test.op, ast.Not):
        return True
    if isinstance(test, ast.Compare):
        for op in test.ops:
            # assert x not in y / assert x != y
            if isinstance(op, (ast.NotIn, ast.NotEq)):
                return True
        # assert x == False / assert x is False
        for comp in test.comparators:
            if isinstance(comp, ast.Constant) and comp.value is False:
                return True
    return False


def _parametrize_has_negative_values(func: ast.FunctionDef) -> bool:
    """Return True if any parametrize decorator includes falsy boundary values.

    Checks for False, None, 0, "", and empty list [] appearing as elements in
    the parametrize cases list — these indicate the test covers negative/zero/
    empty boundary inputs.
    """
    for decorator in func.decorator_list:
        if not isinstance(decorator, ast.Call):
            continue
        func_attr = decorator.func
        if not (isinstance(func_attr, ast.Attribute) and func_attr.attr == "parametrize"):
            continue
        if len(decorator.args) < 2:
            continue
        cases_arg = decorator.args[1]
        if not isinstance(cases_arg, (ast.List, ast.Tuple)):
            continue
        for case in cases_arg.elts:
            if isinstance(case, (ast.List, ast.Tuple)):
                for elt in case.elts:
                    if _is_falsy_constant(elt):
                        return True
            elif _is_falsy_constant(case):
                return True
    return False


def _is_falsy_constant(node: ast.expr) -> bool:
    """Return True if node is a literal False, None, 0, "", or []."""
    if isinstance(node, ast.Constant) and node.value in _FALSY_CONSTANTS:
        return True
    # [] — empty list literal
    return bool(isinstance(node, (ast.List, ast.Tuple)) and len(node.elts) == 0)


# ---------------------------------------------------------------------------
# Ceiling calculator
# ---------------------------------------------------------------------------


def compute_coverage_ceiling(
    func: ast.FunctionDef,
) -> tuple[int, dict[str, Any]]:
    """Compute the programmatic ceiling for coverage_signal (0–4).

    Returns (ceiling, signals) where signals is a dict of the raw structural
    metrics used to derive the ceiling. Both are stored in the sidecar so the
    ceiling decision is transparent and auditable.

    The LLM's coverage_signal score is clamped to this ceiling after evaluation.
    """
    non_trivial = count_non_trivial_assertions(func)
    error_paths = count_error_path_assertions(func)
    param_cases = count_parametrize_cases(func)
    negative = has_negative_coverage(func)
    # Total behavioral checks: specific assertions + explicit error-path blocks.
    # With parametrize, multiply by case count (each assertion runs N times).
    total_behavioral = (non_trivial + error_paths) * param_cases

    signals: dict[str, Any] = {
        "non_trivial_assertions": non_trivial,
        "error_path_assertions": error_paths,
        "parametrize_cases": param_cases,
        "total_behavioral_checks": total_behavioral,
        "has_negative_coverage": negative,
    }
    ceiling = _compute_ceiling(non_trivial + error_paths, param_cases, negative)
    return ceiling, signals


def _compute_ceiling(
    non_trivial: int,
    parametrize_cases: int,
    has_neg: bool,
) -> int:
    """Pure ceiling computation from raw structural signals.

    Args:
        non_trivial: non-trivial assertion count + error-path assertion count combined.
        parametrize_cases: total parametrize combinations (1 if no parametrize).
        has_neg: True if any negative/error coverage is present.

    total_behavioral = non_trivial * parametrize_cases (computed internally).
    This accounts for parametrize multiplying each assertion across N cases.
    """
    if non_trivial == 0:
        return 0

    # Total behavioral checks: each assertion runs across all parametrize cases.
    total_behavioral = non_trivial * parametrize_cases

    if not has_neg:
        # No error/boundary/negative coverage at all.
        if parametrize_cases <= 1:
            # Single scenario: cap at 1 for 1 assertion; 2+ assertions → ceiling 2
            # (multiple assertions checking different aspects counts as variation).
            return 1 if non_trivial < 2 else 2
        # Multiple parametrize cases but no negative/error coverage → ceiling 2.
        return 2

    # Has negative/error coverage.
    # Score 4: total behavioral checks cover enough ground to be "comprehensive"
    # (≥4 checks, accounting for parametrize multiplication).
    if total_behavioral >= 4:
        return 4

    # Score 3: has error/negative AND either multiple scenarios OR multiple assertions.
    if parametrize_cases >= 2 or non_trivial >= 2:
        return 3

    # Has error/negative but only 1 non-trivial assertion in a single scenario → 2.
    return 2
