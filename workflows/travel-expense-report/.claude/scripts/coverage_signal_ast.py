"""Backward-compatibility shim — imports from scenario_breadth_ast.

coverage_signal_ast.py was renamed to scenario_breadth_ast.py when the
dimension was renamed from coverage_signal to scenario_breadth. This shim
preserves import compatibility for existing test files that reference the
old module name.
"""

from scenario_breadth_ast import *  # noqa: F401, F403
from scenario_breadth_ast import (  # noqa: F401
    _compute_ceiling,
    compute_coverage_ceiling,
)
