#!/usr/bin/env python3
"""Evaluate test functions in a file and write analytics sidecar JSON.

Usage:
    python scripts/evaluate_test_file.py tests/test_metadata.py [--force]

Reads the test file, extracts all test_* functions via AST, computes a
body hash per function, detects test_value / test_contract markers, and
invokes Claude via lean-claude.sh to score each function across 8 dimensions (0-4 each).

Results are written/merged into tests/.analytics/<stem>.json.

If --force is given, re-evaluates all functions even if their hash matches
the stored record. Otherwise, only changed or new functions are evaluated.
"""

from __future__ import annotations

import argparse
import ast
import concurrent.futures
import datetime
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).parent.parent.resolve()
ANALYTICS_DIR = REPO_ROOT / "tests" / ".analytics"

sys.path.insert(0, str(Path(__file__).parent))
import contextlib

from _analytics_shared import DIMENSIONS  # noqa: E402
from scenario_breadth_ast import compute_coverage_ceiling  # noqa: E402

RUBRIC = """Score Python test function(s) on 8 dimensions (0-4).
Single function → return ONLY: {"so":<n>,"ci":<n>,"id":<n>,"sb":<n>,"es":<n>,"ma":<n>,"ap":<n>,"ec":<n>,"pp":[<str>,...]}
Multiple functions → return ONLY a JSON array, one object per function in order: [{"so":<n>,...,"pp":[...]},...]

so=structure_organization: 0=confusing/multi-unrelated 1=partial 2=adequate 3=clear+well-parametrized 4=precise+1assert/scenario
ci=contract_intent: 0=none 1=one-of(test_value/test_contract/Contract:doc) 2=two 3=all3 4=all3+Contract-names-specific-trigger-AND-required-outcome(assertion-directly-proves-stated-contract)
id=isolation_determinism: 0=non-deterministic(real-network/random/shared-global-state) 1=env-dependent(hardcoded-path/env-var/external-state) 2=bounded-external(tmpdir/subprocess-deterministic) 3=well-isolated(mocks-external-services/injects-deps) 4=hermetic(pure-logic-or-all-io-injected-no-real-deps)
sb=scenario_breadth: 0=trivial(True/not-None/isinstance/len>=0) 1=>=1-specific-single-scenario 2=>=2-equiv-classes-no-error 3=>=2-classes+error-path 4=full-contract(happy+boundary+error+negative,1check/scenario)
es=execution_speed: 0=sleep/http/unbounded 1=heavy-io>1s 2=subprocess/significant-disk[bounded] 3=minimal-io[DEFAULT] 4=pure-logic — score>=1 unless literal sleep/HTTP/unbounded; score=2 for subprocess regardless-of-output-determinism
ma=maintainability: 0=impl-coupled 1=brittle 2=mostly-behavioral 3=behavioral/low-coupling 4=fully-decoupled
ap=assertion_precision: 0=no-assertion/assert-True 1=identity-check(not-None/isinstance) 2=partial-value(len/type-only) 3=exact-return-value 4=exact-value+error-message+side-effects
ec=edge_coverage: 0=no-boundary-awareness 1=implicit-boundary(single-scenario-accidentally-covers-edge) 2=one-explicit-boundary(empty/zero/max) 3=multiple-boundaries(2-3-explicit-off-by-one-or-empty) 4=systematic(off-by-one+empty+max+negative-all-explicit)
ec ANTI-GAMING: do NOT award ec>0 for: (a) trivially-true lower bounds like `assert 0<=len(x)` or `assert len(x)>=0` (len never negative); (b) assertions logically implied by a stronger assertion already present in the same function (e.g. `assert "_" not in s` when `assert s=="foo"` already appears); (c) `assert not x.is_file()` when `assert x.is_dir()` is already present. These add no bug-catching power.
pp=padding_patterns: list of 0-2 short strings (≤12 words each) naming assertion patterns that would be trivially gaming FOR THIS SPECIFIC FUNCTION — e.g. "assert 0<=len(result)" or "assert name!='X' when name=='Y' already asserted". Empty list [] if no obvious gaming patterns exist for this function."""

# Short key → dimension name mapping. Claude returns compact keys to minimize output tokens.
_SHORT_TO_DIM = {
    "so": "structure_organization",
    "ci": "contract_intent",
    "id": "isolation_determinism",
    "sb": "scenario_breadth",
    "es": "execution_speed",
    "ma": "maintainability",
    "ap": "assertion_precision",
    "ec": "edge_coverage",
}


def _sidecar_key(node: ast.FunctionDef, class_name: str | None) -> str:
    """Derive the sidecar dict key for a test function.

    Class methods use ``ClassName::function_name`` (qualified, collision-free).
    Module-level functions use bare ``function_name`` (unchanged from v1).
    """
    if class_name:
        return f"{class_name}::{node.name}"
    return node.name


def hash_function_body(node: ast.FunctionDef) -> str:
    """Compute an AST-normalized MD5 hash of the function body only.

    Excludes decorators, signature, docstrings-as-comments, and whitespace.
    Only the body statements are hashed, so renaming the function or changing
    markers does not invalidate the hash.
    """
    body_source = ast.unparse(ast.Module(body=node.body, type_ignores=[]))
    return hashlib.md5(body_source.encode(), usedforsecurity=False).hexdigest()


def _scan_marks_for_test_value_contract(
    marks: list[ast.expr],
) -> tuple[str | None, str | None]:
    """Extract (test_value, test_contract) from a list of pytestmark expressions."""
    standalone_values = {"essential", "thorough", "defensive", "structural"}
    contract_types = {"postcondition", "precondition", "invariant", "regression", "behavior"}
    test_value: str | None = None
    test_contract: str | None = None
    for mark in marks:
        if (
            isinstance(mark, ast.Call)
            and isinstance(mark.func, ast.Attribute)
            and mark.func.attr == "test_value"
            and mark.args
            and isinstance(mark.args[0], ast.Constant)
        ):
            test_value = str(mark.args[0].value)
        elif (
            isinstance(mark, ast.Call)
            and isinstance(mark.func, ast.Attribute)
            and mark.func.attr == "test_contract"
            and mark.args
            and isinstance(mark.args[0], ast.Constant)
        ):
            test_contract = str(mark.args[0].value)
        elif isinstance(mark, ast.Attribute) and mark.attr in standalone_values:
            test_value = mark.attr
        elif isinstance(mark, ast.Attribute) and mark.attr in contract_types:
            test_contract = mark.attr
    return test_value, test_contract


def _pytestmark_from_stmts(stmts: list[ast.stmt]) -> tuple[str | None, str | None]:
    """Find pytestmark = [...] or pytestmark = pytest.mark.X and extract TQS markers."""
    for stmt in stmts:
        if not isinstance(stmt, ast.Assign):
            continue
        for target in stmt.targets:
            if isinstance(target, ast.Name) and target.id == "pytestmark":
                value = stmt.value
                marks: list[ast.expr] = value.elts if isinstance(value, ast.List) else [value]
                return _scan_marks_for_test_value_contract(marks)
    return None, None


def detect_markers(
    node: ast.FunctionDef,
    inherited: tuple[str | None, str | None] = (None, None),
) -> tuple[str | None, str | None]:
    """Return (test_value, test_contract) from decorators or inherited pytestmark.

    Function-level decorators take precedence; inherited values (from module-level
    or class-level pytestmark assignments) are used as fallback.

    Supports both canonical parameterized form:
        @pytest.mark.test_value("essential")
    And standalone alias form:
        @pytest.mark.essential
    """
    test_value, test_contract = _scan_marks_for_test_value_contract(node.decorator_list)

    # Fall back to inherited pytestmark if not set by function-level decorators
    if test_value is None:
        test_value = inherited[0]
    if test_contract is None:
        test_contract = inherited[1]

    return test_value, test_contract


def extract_contract_docstring(node: ast.FunctionDef) -> str | None:
    """Extract the full 'Contract: ...' paragraph from the function docstring."""
    if not node.body:
        return None
    first = node.body[0]
    if not isinstance(first, ast.Expr) or not isinstance(first.value, ast.Constant):
        return None
    docstring = str(first.value.value)
    lines = docstring.splitlines()
    collecting = False
    parts: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("Contract:"):
            collecting = True
            parts.append(stripped)
        elif collecting:
            if stripped == "":
                break  # blank line ends the paragraph
            parts.append(stripped)
    return " ".join(parts) if parts else None


def get_function_source(source_lines: list[str], node: ast.FunctionDef) -> str:
    """Return the raw source lines for a function node."""
    start = node.lineno - 1
    end = node.end_lineno or (node.lineno + 1)
    return "".join(source_lines[start:end])


def extract_test_functions(source: str) -> list[ast.FunctionDef]:
    """Return all top-level and class-method FunctionDef nodes named test_*."""
    tree = ast.parse(source)
    return [node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef) and node.name.startswith("test_")]


def _names_called_in(node: ast.FunctionDef) -> set[str]:
    """Return all function/attribute names called or accessed inside a test function."""
    names: set[str] = set()
    for child in ast.walk(node):
        if isinstance(child, ast.Call):
            if isinstance(child.func, ast.Name):
                names.add(child.func.id)
            elif isinstance(child.func, ast.Attribute):
                names.add(child.func.attr)
        elif isinstance(child, ast.Name):
            names.add(child.id)
        elif isinstance(child, ast.Attribute):
            names.add(child.attr)
    return names


def extract_relevant_source(module_source: str, test_node: ast.FunctionDef) -> str:
    """Extract only the definitions from module_source that the test function references.

    Instead of sending an entire source module (potentially thousands of tokens),
    this walks the test's AST to collect every name it uses, then extracts only the
    matching top-level definitions (functions, classes, constants) from the module.

    Falls back to the full module source if parsing fails or nothing matches.
    """
    try:
        tree = ast.parse(module_source)
    except SyntaxError:
        return module_source

    referenced = _names_called_in(test_node)
    module_lines = module_source.splitlines(keepends=True)
    chunks: list[str] = []

    for stmt in tree.body:
        name: str | None = None
        if isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            name = stmt.name
        elif isinstance(stmt, ast.Assign):
            # Top-level constants: HOOK_TIMEOUT_SECONDS = 60, etc.
            for target in stmt.targets:
                if isinstance(target, ast.Name) and target.id in referenced:
                    start = stmt.lineno - 1
                    end = stmt.end_lineno or stmt.lineno
                    chunks.append("".join(module_lines[start:end]))
            continue

        if name and name in referenced:
            start = stmt.lineno - 1
            end = stmt.end_lineno or stmt.lineno
            chunks.append("".join(module_lines[start:end]))

    if not chunks:
        # Nothing matched — return empty so the caller sends no source section.
        # The rubric scores all 6 dimensions from the test body alone; cv is
        # additionally clamped by the AST ceiling, so no source context is needed
        # when none of the test's referenced names resolve to top-level defs.
        # Falling back to the full module would send up to 500 wasted tokens.
        return ""

    return "\n\n".join(chunks)


def call_claude_evaluate(
    func_source: str,
    source_module: str | None = None,
    test_value: str | None = None,
    test_contract: str | None = None,
    contract_docstring: str | None = None,
    test_node: ast.FunctionDef | None = None,
    coverage_ceiling: int = 4,
    coverage_signals: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Invoke Claude (Haiku) to score the function. Returns parsed JSON or None on failure.

    RUBRIC is the system prompt (~233 tokens, constant). The user message contains only
    the test function, relevant source excerpt, and compact one-liner metadata/ceiling.
    --bare suppresses the ~2,000-token Claude Code default system prompt (the single
    largest cost item). cwd=/tmp provides belt-and-suspenders CLAUDE.md isolation.
    Token budget per call:
        ~233 system prompt (RUBRIC — compact short-key JSON template, no rationale)
        ~28  compact metadata + ceiling (one-liner each)
        ~80  test function source (average)
        ~75  relevant source excerpt (only referenced definitions)
        ~30  output (8 integers: {"so":N,"ci":N,"id":N,"sb":N,"es":N,"ma":N,"ap":N,"ec":N})
    Total: ~446 tokens per call (~766 before short-key/no-rationale opt,
                                 ~2,766 before --bare, ~37,900 original full context).
    Model: claude-haiku-4-5-20251001 — sufficient for structured JSON scoring.

    Args:
        func_source: Raw source text of the test function.
        source_module: Path to the source module under test (repo-relative).
            Only the definitions referenced by the test are extracted and sent.
        test_value: Pre-extracted @pytest.mark.test_value level.
        test_contract: Pre-extracted @pytest.mark.test_contract type.
        contract_docstring: Pre-extracted full Contract: paragraph from the docstring.
        test_node: AST node of the test function, used for smart source extraction.
            When None, falls back to sending the full source module.
    """
    context_section = ""
    if source_module:
        source_path = REPO_ROOT / source_module
        if source_path.exists():
            try:
                module_source = source_path.read_text()
                excerpt = extract_relevant_source(module_source, test_node) if test_node is not None else module_source
                # Cap excerpt to avoid timeouts on large function bodies.
                if len(excerpt) > 2_000:
                    excerpt = excerpt[:2_000].rsplit("\n", 1)[0] + "\n# (truncated)"
                context_section = f"\nSource ({source_module}):\n```python\n{excerpt}\n```"
            except OSError:
                pass

    # Compact one-liner: pre-extracted markers so Claude does not re-derive from source.
    meta_parts = []
    if test_value is not None:
        meta_parts.append(f"tv={test_value}")
    if test_contract is not None:
        meta_parts.append(f"tc={test_contract}")
    if contract_docstring is not None:
        meta_parts.append(f"Contract:{contract_docstring}")
    metadata_section = "\nmarkers: " + " ".join(meta_parts) if meta_parts else ""

    # Compact one-liner ceiling: hard constraint from AST analysis.
    signals = coverage_signals or {}
    nt = signals.get("non_trivial_assertions", "?")
    ep = signals.get("error_path_assertions", 0)
    pc = signals.get("parametrize_cases", "?")
    ceiling_section = f"\ncv_ceiling:{coverage_ceiling}/4 ({nt}nt+{ep}ep*{pc}cases — MUST NOT exceed)"

    prompt = f"{metadata_section}\nTest:\n```python\n{func_source}\n```{context_section}{ceiling_section}"

    lean_claude = REPO_ROOT / ".claude" / "scripts" / "lean-claude.sh"
    try:
        result = subprocess.run(
            [
                "bash",
                str(lean_claude),
                "--system",
                RUBRIC,
                "--model",
                "claude-haiku-4-5-20251001",
                "--format",
                "text",
                prompt,
            ],
            capture_output=True,
            text=True,
            timeout=180,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError) as exc:
        print(f"[TQS] Claude invocation failed: {exc}", file=sys.stderr)
        return None

    output = result.stdout.strip()
    # Strip markdown code fences if present
    if output.startswith("```"):
        lines = output.splitlines()
        output = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

    def _try_loads(s: str) -> dict | None:
        try:
            return json.loads(s)
        except json.JSONDecodeError:
            return None

    # Direct parse
    parsed = _try_loads(output)
    if parsed is not None:
        return parsed

    # Extract first balanced {...} block (handles trailing rationale text)
    depth = 0
    start = None
    for i, ch in enumerate(output):
        if ch == "{":
            if start is None:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start is not None:
                candidate = output[start : i + 1]
                parsed = _try_loads(candidate)
                if parsed is not None:
                    return parsed
                break

    # Fallback: regex extraction
    match = re.search(r"\{.*?\}", output, re.DOTALL)
    if match:
        parsed = _try_loads(match.group())
        if parsed is not None:
            return parsed
        for suffix in ["}", "}}", "}}}"]:
            parsed = _try_loads(match.group() + suffix)
            if parsed is not None:
                return parsed

    print(f"[TQS] Could not parse Claude response:\n{output}", file=sys.stderr)
    return None


def call_claude_evaluate_batch(
    items: list[dict[str, Any]],
) -> list[dict[str, Any] | None]:
    """Score multiple test functions in a single Claude call.

    Sends N functions as a numbered list in one prompt; Claude returns a JSON array
    with N objects in the same order. Reduces process-spawn overhead from N calls to 1.

    Each item dict must have keys:
        func_source, source_module, test_value, test_contract,
        contract_docstring, test_node, coverage_ceiling, coverage_signals

    Returns a list of length len(items): each element is a parsed score dict or None.
    On batch failure (timeout or parse error), falls back to individual calls so
    no function is silently dropped.
    """
    if not items:
        return []
    if len(items) == 1:
        result = call_claude_evaluate(**items[0])
        return [result]

    # Build numbered multi-function prompt.
    parts: list[str] = [f"Score these {len(items)} test functions. Return a JSON array with {len(items)} objects.\n"]
    for i, item in enumerate(items, 1):
        func_source = item["func_source"]
        source_module = item.get("source_module")
        test_value = item.get("test_value")
        test_contract = item.get("test_contract")
        contract_docstring = item.get("contract_docstring")
        test_node = item.get("test_node")
        coverage_ceiling = item.get("coverage_ceiling", 4)
        coverage_signals = item.get("coverage_signals") or {}

        context_section = ""
        if source_module:
            source_path = REPO_ROOT / source_module
            if source_path.exists():
                try:
                    module_source = source_path.read_text()
                    excerpt = extract_relevant_source(module_source, test_node) if test_node else module_source
                    # Aggressive cap in batch mode: keeps prompt size manageable.
                    if len(excerpt) > 800:
                        excerpt = excerpt[:800].rsplit("\n", 1)[0] + "\n# (truncated)"
                    context_section = f"\n  Source ({source_module}):\n  ```python\n{excerpt}\n  ```"
                except OSError:
                    pass

        meta_parts = []
        if test_value is not None:
            meta_parts.append(f"tv={test_value}")
        if test_contract is not None:
            meta_parts.append(f"tc={test_contract}")
        if contract_docstring is not None:
            meta_parts.append(f"Contract:{contract_docstring}")
        meta_line = " markers: " + " ".join(meta_parts) if meta_parts else ""

        nt = coverage_signals.get("non_trivial_assertions", "?")
        ep = coverage_signals.get("error_path_assertions", 0)
        pc = coverage_signals.get("parametrize_cases", "?")
        ceiling_line = f" cv_ceiling:{coverage_ceiling}/4 ({nt}nt+{ep}ep*{pc}cases — MUST NOT exceed)"

        parts.append(f"[{i}]{meta_line}{ceiling_line}\n```python\n{func_source}\n```{context_section}")

    prompt = "\n".join(parts)

    lean_claude = REPO_ROOT / ".claude" / "scripts" / "lean-claude.sh"
    batch_failed = False
    output = ""
    try:
        result = subprocess.run(
            [
                "bash",
                str(lean_claude),
                "--system",
                RUBRIC,
                "--model",
                "claude-haiku-4-5-20251001",
                "--format",
                "text",
                prompt,
            ],
            capture_output=True,
            text=True,
            timeout=240,
        )
        output = result.stdout.strip()
    except subprocess.TimeoutExpired as exc:
        print(f"[TQS] Batch timed out ({len(items)} fns) — falling back to individual calls: {exc}", file=sys.stderr)
        batch_failed = True
    except FileNotFoundError as exc:
        print(f"[TQS] lean-claude.sh not found: {exc}", file=sys.stderr)
        return [None] * len(items)

    if not batch_failed:
        if output.startswith("```"):
            lines = output.splitlines()
            output = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

        # Try parsing as JSON array first.
        parsed: list[dict[str, Any] | None] | None = None
        try:
            data = json.loads(output)
            if isinstance(data, list):
                parsed = [d if isinstance(d, dict) else None for d in data]
        except json.JSONDecodeError:
            # Try extracting [...] block.
            match = re.search(r"\[.*\]", output, re.DOTALL)
            if match:
                try:
                    data = json.loads(match.group())
                    if isinstance(data, list):
                        parsed = [d if isinstance(d, dict) else None for d in data]
                except json.JSONDecodeError:
                    pass

        if parsed is None:
            # Try salvaging complete {…} objects from truncated array output.
            complete_objects = re.findall(r"\{[^{}]+\}", output)
            if complete_objects:
                salvaged: list[dict[str, Any] | None] = []
                for obj_str in complete_objects:
                    with contextlib.suppress(json.JSONDecodeError):
                        salvaged.append(json.loads(obj_str))
                if salvaged:
                    parsed = salvaged

        if parsed is not None:
            # If we got all N results, return them directly.
            if len(parsed) >= len(items):
                return parsed[: len(items)]
            # Partial results: use what we have and fall back for the rest.
            print(
                f"[TQS] Batch partial ({len(parsed)}/{len(items)} fns parsed) — "
                f"falling back for remaining {len(items) - len(parsed)}",
                file=sys.stderr,
            )
            fallback_results = [call_claude_evaluate(**items[i]) for i in range(len(parsed), len(items))]
            return [*parsed, *fallback_results]

        # Fall back: try parsing as single object (model ignored batch instruction).
        try:
            single = json.loads(output)
            if isinstance(single, dict) and len(items) == 1:
                return [single]
        except json.JSONDecodeError:
            pass

        print(
            f"[TQS] Batch parse failed ({len(items)} fns) — falling back to individual calls",
            file=sys.stderr,
        )

    # Full fallback: call each function individually.
    return [call_claude_evaluate(**item) for item in items]


def load_sidecar(sidecar_path: Path) -> dict[str, Any]:
    """Load existing sidecar JSON, returning only function records.

    Strips top-level non-dict entries (e.g. ``schema_version``) so callers
    always receive a ``{key: record}`` mapping of function records only.
    """
    if sidecar_path.exists():
        try:
            raw = json.loads(sidecar_path.read_text())
            return {k: v for k, v in raw.items() if isinstance(v, dict)}
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def write_sidecar_atomic(sidecar_path: Path, data: dict[str, Any]) -> None:
    """Write sidecar JSON atomically via a temp file.

    Injects ``schema_version: 2`` at the top of the payload so every written
    sidecar is version-stamped.  On failure, the .tmp file is left in place for
    inspection and the error is logged before re-raising.
    """
    sidecar_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = sidecar_path.with_suffix(".json.tmp")
    payload = {"schema_version": 2, **data}
    try:
        tmp_path.write_text(json.dumps(payload, indent=2, sort_keys=True))
        tmp_path.replace(sidecar_path)
    except OSError as exc:
        print(
            f"[TQS] ERROR writing sidecar {sidecar_path}: {exc}. Partial data may be at {tmp_path}",
            file=sys.stderr,
        )
        raise


def _infer_source_module(test_path: Path) -> str | None:
    """Infer the source module path from a test file path.

    Strips the 'test_' prefix from the stem and searches for a matching
    .py file under src/. Returns a repo-relative path string or None.

    Example: tests/test_metadata.py → src/code_practices/metadata.py
    """
    stem = test_path.stem  # e.g. "test_metadata"
    if not stem.startswith("test_"):
        return None
    module_name = stem[len("test_") :]  # e.g. "metadata"
    src_dir = REPO_ROOT / "src"
    if not src_dir.exists():
        return None
    # Walk src/ and find first match by stem
    for candidate in src_dir.rglob(f"{module_name}.py"):
        return str(candidate.relative_to(REPO_ROOT))
    return None


def _evaluate_one(
    node: ast.FunctionDef,
    inherited: tuple[str | None, str | None],
    class_name: str | None,
    source_lines: list[str],
    existing: dict[str, Any] | None,
    stem: str,
    source_module: str | None,
    path: Path,
    force: bool,
) -> tuple[str, dict[str, Any]] | None:
    """Evaluate a single test function and return (sidecar_key, record) or None.

    Designed to be called from a thread pool — pure function with no shared
    mutable state. The caller is responsible for writing results to the sidecar.
    The returned key is qualified (``ClassName::func_name``) for class methods.
    """
    base_name = node.name
    sidecar_key = _sidecar_key(node, class_name)
    current_hash = hash_function_body(node)

    # Compute source_hash: hash of the source module being tested.
    # Re-evaluation is skipped when BOTH body_hash AND source_hash are unchanged.
    source_hash: str | None = None
    if source_module:
        source_path = REPO_ROOT / source_module
        if source_path.exists():
            source_hash = hashlib.md5(source_path.read_bytes(), usedforsecurity=False).hexdigest()

    if not force and existing and existing.get("body_hash") == current_hash:
        if source_hash is None or existing.get("source_hash") == source_hash:
            return None  # body and source both unchanged — skip

    test_value, test_contract = detect_markers(node, inherited=inherited)
    contract_docstring = extract_contract_docstring(node)
    func_source = get_function_source(source_lines, node)

    # Compute programmatic ceiling before calling Claude — used in prompt and clamping.
    coverage_ceiling, coverage_signals = compute_coverage_ceiling(node)

    print(f"[TQS] Evaluating {stem}::{base_name} (coverage ceiling: {coverage_ceiling}/4) ...", flush=True)
    claude_result = call_claude_evaluate(
        func_source,
        source_module=source_module,
        test_value=test_value,
        test_contract=test_contract,
        contract_docstring=contract_docstring,
        test_node=node,
        coverage_ceiling=coverage_ceiling,
        coverage_signals=coverage_signals,
    )

    if claude_result is None:
        print(f"[TQS] Skipping {base_name} (evaluation failed)", file=sys.stderr)
        return None

    # Claude returns compact short keys: {"so":N,"ci":N,"id":N,"sb":N,"es":N,"ma":N,"ap":N,"ec":N}.
    # Fall back to long-name "dimensions" wrapper for backward compat with test mocks.
    if not isinstance(claude_result, dict):
        print(f"[TQS] Skipping {base_name} (malformed response)", file=sys.stderr)
        return None
    if "dimensions" in claude_result:
        raw_dims = claude_result["dimensions"]
        if not isinstance(raw_dims, dict):
            print(f"[TQS] Skipping {base_name} (malformed 'dimensions' in response)", file=sys.stderr)
            return None
        clamped_dims = {d: max(0, min(4, int(raw_dims.get(d, 0)))) for d in DIMENSIONS}
    else:
        clamped_dims = {full: max(0, min(4, int(claude_result.get(short, 0)))) for short, full in _SHORT_TO_DIM.items()}
    # Apply programmatic ceiling: scenario_breadth cannot exceed the AST-derived ceiling.
    if clamped_dims["scenario_breadth"] > coverage_ceiling:
        print(
            f"[TQS] {base_name}: scenario_breadth clamped "
            f"{clamped_dims['scenario_breadth']} → {coverage_ceiling} (AST ceiling)",
            file=sys.stderr,
        )
        clamped_dims["scenario_breadth"] = coverage_ceiling
    # Programmatic execution_speed floors: RUBRIC says score>=1 unless literal sleep/HTTP,
    # and score>=2 for subprocess/disk calls. Haiku consistently underscores these.
    _src = func_source or ""
    _TRULY_UNBOUNDED = (
        "time.sleep(",
        "sleep(",
        "requests.get(",
        "requests.post(",
        "requests.put(",
        "requests.delete(",
        "requests.patch(",
        "httpx.",
        "urllib.request.",
        "http.client.",
        "aiohttp.",
    )
    _SUBPROCESS_PATTERNS = (
        "subprocess.run(",
        "subprocess.call(",
        "subprocess.check_call(",
        "subprocess.check_output(",
        "subprocess.Popen(",
        "CliRunner()",
        "CliRunner().invoke(",
        "runner.invoke(",
        ".invoke(",
    )
    if clamped_dims["execution_speed"] == 0 and not any(pat in _src for pat in _TRULY_UNBOUNDED):
        clamped_dims["execution_speed"] = 1
    if clamped_dims["execution_speed"] <= 1 and any(pat in _src for pat in _SUBPROCESS_PATTERNS):
        clamped_dims["execution_speed"] = 2
    total = sum(clamped_dims.values())
    evaluated_at = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    # Extract padding_patterns from response — list of 0-2 short strings.
    raw_pp = claude_result.get("pp", [])
    padding_patterns: list[str] = [str(p) for p in raw_pp if isinstance(p, str)] if isinstance(raw_pp, list) else []

    prev_history: list[dict[str, Any]] = existing.get("score_history", []) if existing else []
    new_entry: dict[str, Any] = {
        "total_score": total,
        "dimensions": dict(clamped_dims),
        "evaluated_at": evaluated_at,
    }
    score_history = [*prev_history, new_entry][-20:]

    # Score stability metrics — guards against LLM non-determinism regressing gates.
    score_values = [e["total_score"] for e in score_history if isinstance(e.get("total_score"), int)]
    if len(score_values) >= 2:
        sorted_vals = sorted(score_values)
        n_sv = len(sorted_vals)
        score_median: float = (
            sorted_vals[n_sv // 2] if n_sv % 2 == 1 else (sorted_vals[n_sv // 2 - 1] + sorted_vals[n_sv // 2]) / 2.0
        )
        mean_sv = sum(score_values) / n_sv
        variance = sum((x - mean_sv) ** 2 for x in score_values) / n_sv
        stdev = variance**0.5
        stability_flag = "stable" if stdev < 1.5 else ("oscillating" if stdev < 3.0 else "unstable")
    else:
        score_median = float(total)
        stdev = 0.0
        stability_flag = "new"

    record: dict[str, Any] = {
        "function_name": base_name,
        "file_path": str(path.relative_to(REPO_ROOT)),
        "dimensions": clamped_dims,
        "total_score": total,
        "score_median": round(score_median, 1),
        "score_stdev": round(stdev, 2),
        "stability_flag": stability_flag,
        "padding_patterns": padding_patterns,
        "test_value": test_value,
        "test_contract": test_contract,
        "contract_docstring": contract_docstring,
        "body_hash": current_hash,
        "body_hash_algo": "md5-ast-unparse",
        "source_hash": source_hash,
        "evaluated_at": evaluated_at,
        "score_history": score_history,
        "scenario_breadth_ceiling": coverage_ceiling,
        "scenario_breadth_signals": coverage_signals,
    }
    return sidecar_key, record


def evaluate_file(
    path: Path,
    force: bool = False,
    workers: int = 1,
    batch_size: int = 5,
    only_functions: set[str] | None = None,
) -> int:
    """Evaluate test functions in path and update the analytics sidecar.

    Args:
        path: Test file to evaluate.
        force: Re-evaluate all functions regardless of cached hashes.
        workers: Number of parallel Claude invocations. Default 1 (sequential).
            Set to 20 for full-suite bootstrap runs to reduce wall-clock time.
        batch_size: Number of functions to score per Claude call. Default 5.
            Higher values reduce process-spawn overhead but increase prompt size.
            Set to 1 to disable batching (one call per function).
        only_functions: When given, restrict evaluation to these function names
            (force-re-evaluates regardless of cached hash). Useful for targeted
            re-scoring after assertion improvements.

    Returns the number of functions evaluated (new or changed).
    """
    # Security: ensure path is within repo root
    try:
        path.resolve().relative_to(REPO_ROOT)
    except ValueError:
        raise ValueError(f"Refusing to evaluate path outside repo: {path}") from None

    if not path.exists():
        print(f"[TQS] File not found: {path}", file=sys.stderr)
        return 0

    try:
        source = path.read_text()
    except OSError as exc:
        print(f"[TQS] Cannot read {path}: {exc}", file=sys.stderr)
        return 0

    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        print(f"[TQS] Syntax error in {path}: {exc}", file=sys.stderr)
        return 0

    # Collect (func_node, inherited_markers) pairs, honouring pytestmark inheritance.
    module_inherited = _pytestmark_from_stmts(tree.body)
    func_pairs: list[tuple[ast.FunctionDef, tuple[str | None, str | None], str | None]] = []
    for stmt in tree.body:
        if isinstance(stmt, ast.FunctionDef) and stmt.name.startswith("test_"):
            func_pairs.append((stmt, module_inherited, None))
        elif isinstance(stmt, ast.ClassDef):
            cls_tv, cls_tc = _pytestmark_from_stmts(stmt.body)
            # Also detect class-level decorators: @pytest.mark.test_value("thorough")
            # _pytestmark_from_stmts only finds pytestmark = [...] assignments;
            # class decorator syntax is equally valid and common.
            dec_tv, dec_tc = _scan_marks_for_test_value_contract(stmt.decorator_list)
            cls_tv = cls_tv if cls_tv is not None else dec_tv
            cls_tc = cls_tc if cls_tc is not None else dec_tc
            cls_inherited: tuple[str | None, str | None] = (
                cls_tv if cls_tv is not None else module_inherited[0],
                cls_tc if cls_tc is not None else module_inherited[1],
            )
            func_pairs.extend(
                (item, cls_inherited, stmt.name)
                for item in stmt.body
                if isinstance(item, ast.FunctionDef) and item.name.startswith("test_")
            )

    if not func_pairs:
        return 0

    source_lines = source.splitlines(keepends=True)
    tests_root = REPO_ROOT / "tests"
    try:
        rel = path.resolve().relative_to(tests_root)
    except ValueError:
        rel = Path(path.name)
    sidecar_path = ANALYTICS_DIR / rel.parent / f"{rel.stem}.json"
    stem = rel.stem
    sidecar = load_sidecar(sidecar_path)
    source_module: str | None = _infer_source_module(path)

    # Deduplicate: parametrize generates multiple IDs at collection time but
    # the AST has a single node per definition. Use qualified sidecar keys so
    # same-named methods in different classes are tracked independently.
    seen: set[str] = set()
    deduped: list[tuple[ast.FunctionDef, tuple[str | None, str | None], str | None]] = []
    for node, inherited, cls_name in func_pairs:
        key = _sidecar_key(node, cls_name)
        if key not in seen:
            seen.add(key)
            deduped.append((node, inherited, cls_name))

    # Prune orphaned entries: sidecar entries for functions that no longer exist
    # in the test file accumulate when functions are renamed or removed. Remove
    # them so stale low scores don't pollute gate checks.
    current_keys = {_sidecar_key(node, cls) for node, _, cls in deduped}
    orphaned = set(sidecar.keys()) - current_keys
    if orphaned:
        for name in orphaned:
            del sidecar[name]
        write_sidecar_atomic(sidecar_path, sidecar)
        print(
            f"[TQS] Pruned {len(orphaned)} orphaned entry(ies) from {sidecar_path.relative_to(REPO_ROOT)}: {', '.join(sorted(orphaned))}"
        )

    def _task(
        item: tuple[ast.FunctionDef, tuple[str | None, str | None], str | None],
    ) -> tuple[str, dict[str, Any]] | None:
        node, inherited, cls_name = item
        return _evaluate_one(
            node,
            inherited,
            cls_name,
            source_lines,
            sidecar.get(_sidecar_key(node, cls_name)),
            stem,
            source_module,
            path,
            force,
        )

    # Filter to only functions that need evaluation (hash changed or force).
    pending: list[tuple[ast.FunctionDef, tuple[str | None, str | None], str | None]] = []
    for node, inherited, cls_name in deduped:
        if only_functions is not None and node.name not in only_functions:
            continue
        current_hash = hash_function_body(node)
        sk = _sidecar_key(node, cls_name)
        if only_functions is not None or force or not sidecar.get(sk) or sidecar[sk].get("body_hash") != current_hash:
            pending.append((node, inherited, cls_name))

    results: list[tuple[str, dict[str, Any]]] = []

    effective_batch = max(1, batch_size)
    if effective_batch <= 1 or workers > 1:
        # Single-function mode or parallel workers — use existing per-function path.
        if workers <= 1:
            for item in pending:
                result = _task(item)
                if result is not None:
                    results.append(result)
        else:
            with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
                for result in pool.map(_task, pending):
                    if result is not None:
                        results.append(result)
    else:
        # Batch mode: group functions, call Claude once per batch.
        def _prepare_batch_item(
            node: ast.FunctionDef,
            inherited: tuple[str | None, str | None],
            cls_name: str | None,
        ) -> dict[str, Any]:
            test_value, test_contract = detect_markers(node, inherited=inherited)
            contract_docstring = extract_contract_docstring(node)
            func_source = get_function_source(source_lines, node)
            coverage_ceiling, coverage_signals = compute_coverage_ceiling(node)
            sk = _sidecar_key(node, cls_name)
            return {
                "func_source": func_source,
                "source_module": source_module,
                "test_value": test_value,
                "test_contract": test_contract,
                "contract_docstring": contract_docstring,
                "test_node": node,
                "coverage_ceiling": coverage_ceiling,
                "coverage_signals": coverage_signals,
                "_node": node,
                "_cls_name": cls_name,
                "_stem": stem,
                "_path": path,
                "_existing": sidecar.get(sk),
            }

        for batch_start in range(0, len(pending), effective_batch):
            batch_pairs = pending[batch_start : batch_start + effective_batch]
            batch_items = [_prepare_batch_item(node, inh, cls) for node, inh, cls in batch_pairs]

            names = [item["_node"].name for item in batch_items]
            print(
                f"[TQS] Evaluating batch of {len(batch_items)}: "
                f"{stem}::{names[0]}" + (f" … {names[-1]}" if len(names) > 1 else ""),
                flush=True,
            )

            # Strip internal keys before passing to Claude.
            claude_items = [{k: v for k, v in item.items() if not k.startswith("_")} for item in batch_items]
            scores = call_claude_evaluate_batch(claude_items)

            for item, score in zip(batch_items, scores, strict=False):
                node = item["_node"]
                base_name = node.name
                cls_name = item["_cls_name"]
                sidecar_key = _sidecar_key(node, cls_name)
                existing = item["_existing"]
                func_source = item["func_source"]
                coverage_ceiling = item["coverage_ceiling"]
                coverage_signals = item["coverage_signals"] or {}

                if score is None:
                    print(f"[TQS] Skipping {base_name} (batch evaluation failed)", file=sys.stderr)
                    continue

                if not isinstance(score, dict):
                    print(f"[TQS] Skipping {base_name} (malformed batch score)", file=sys.stderr)
                    continue

                # Map short keys → full names (same logic as _evaluate_one).
                if "dimensions" in score:
                    raw_dims = score["dimensions"]
                    clamped_dims = {d: max(0, min(4, int(raw_dims.get(d, 0)))) for d in DIMENSIONS}
                else:
                    clamped_dims = {
                        full: max(0, min(4, int(score.get(short, 0)))) for short, full in _SHORT_TO_DIM.items()
                    }

                # AST ceiling clamp.
                if clamped_dims["scenario_breadth"] > coverage_ceiling:
                    print(
                        f"[TQS] {base_name}: scenario_breadth clamped "
                        f"{clamped_dims['scenario_breadth']} → {coverage_ceiling} (AST ceiling)",
                        file=sys.stderr,
                    )
                    clamped_dims["scenario_breadth"] = coverage_ceiling

                # Execution speed floors.
                _src = func_source or ""
                _TRULY_UNBOUNDED = (
                    "time.sleep(",
                    "sleep(",
                    "requests.get(",
                    "requests.post(",
                    "requests.put(",
                    "requests.delete(",
                    "requests.patch(",
                    "httpx.",
                    "urllib.request.",
                    "http.client.",
                    "aiohttp.",
                )
                _SUBPROCESS_PATTERNS = (
                    "subprocess.run(",
                    "subprocess.call(",
                    "subprocess.check_call(",
                    "subprocess.check_output(",
                    "subprocess.Popen(",
                    "CliRunner()",
                    "CliRunner().invoke(",
                    "runner.invoke(",
                    ".invoke(",
                )
                if clamped_dims["execution_speed"] == 0:
                    if not any(pat in _src for pat in _TRULY_UNBOUNDED):
                        clamped_dims["execution_speed"] = 1
                if clamped_dims["execution_speed"] <= 1:
                    if any(pat in _src for pat in _SUBPROCESS_PATTERNS):
                        clamped_dims["execution_speed"] = 2

                total = sum(clamped_dims.values())
                evaluated_at = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
                current_hash = hash_function_body(node)
                prev_history = existing.get("score_history", []) if existing else []
                new_entry: dict[str, Any] = {
                    "total_score": total,
                    "dimensions": dict(clamped_dims),
                    "evaluated_at": evaluated_at,
                }

                # Extract padding_patterns from response — list of 0-2 short strings.
                raw_pp = score.get("pp", [])
                padding_patterns: list[str] = (
                    [str(p) for p in raw_pp if isinstance(p, str)] if isinstance(raw_pp, list) else []
                )

                record: dict[str, Any] = {
                    "function_name": base_name,
                    "file_path": str(path.relative_to(REPO_ROOT)),
                    "dimensions": clamped_dims,
                    "total_score": total,
                    "padding_patterns": padding_patterns,
                    "test_value": item["test_value"],
                    "test_contract": item["test_contract"],
                    "contract_docstring": item["contract_docstring"],
                    "body_hash": current_hash,
                    "body_hash_algo": "md5-ast-unparse",
                    "evaluated_at": evaluated_at,
                    "score_history": [*prev_history, new_entry][-20:],
                    "scenario_breadth_ceiling": coverage_ceiling,
                    "scenario_breadth_signals": coverage_signals,
                }
                results.append((sidecar_key, record))

    for name, record in results:
        sidecar[name] = record

    if results:
        write_sidecar_atomic(sidecar_path, sidecar)
        print(f"[TQS] Updated {sidecar_path.relative_to(REPO_ROOT)} ({len(results)} functions)")

    return len(results)


_BETA_PHASES = {"beta", "pilot", "validation", "production"}


def _read_project_phase() -> str | None:
    """Read the phase field from project-meta.yaml, or return None if unavailable."""
    meta_path = REPO_ROOT / "project-meta.yaml"
    if not meta_path.exists():
        return None
    try:
        import yaml  # type: ignore[import-untyped]

        data = yaml.safe_load(meta_path.read_text()) or {}
        return str(data.get("phase", "")) or None
    except Exception:  # noqa: BLE001
        return None


def main() -> None:
    """Entry point for CLI invocation."""
    parser = argparse.ArgumentParser(
        description="Evaluate test functions and write analytics sidecar.",
        epilog=(
            "TQS is automatically run in CI from beta phase onwards. "
            "For earlier phases, pass --allow-pre-beta to run manually without affecting CI."
        ),
    )
    parser.add_argument("file", type=Path, help="Test file to evaluate")
    parser.add_argument("--force", action="store_true", help="Re-evaluate all functions, ignoring cached hashes")
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        metavar="N",
        help="Parallel Claude invocations (default: 1). Use 20 for full-suite bootstrap runs.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=5,
        metavar="N",
        help="Functions per Claude call (default: 5). Set to 1 to disable batching.",
    )
    parser.add_argument(
        "--allow-pre-beta",
        action="store_true",
        help=(
            "Allow manual TQS evaluation before the project reaches beta phase. "
            "This does not enable automatic TQS — it runs exactly once, right now. "
            "Use this for exploratory audits on alpha/prototype projects."
        ),
    )
    parser.add_argument(
        "--functions",
        metavar="NAMES",
        default=None,
        help=(
            "Comma-separated list of test function names to re-evaluate "
            "(force-rescores those functions regardless of cached hash). "
            "Example: --functions test_foo,test_bar"
        ),
    )
    args = parser.parse_args()

    # Phase gate: TQS runs automatically in CI from beta onwards. Before beta,
    # require --allow-pre-beta to make the manual intent explicit.
    phase = _read_project_phase()
    if phase and phase not in _BETA_PHASES and not args.allow_pre_beta:
        print(
            f"[TQS] Project phase is '{phase}' (pre-beta). TQS runs automatically from beta onwards.\n"
            f"      To evaluate manually now: add --allow-pre-beta\n"
            f"      This will run once and not change when TQS triggers in CI.",
            file=sys.stderr,
        )
        sys.exit(1)

    only_functions: set[str] | None = None
    if args.functions:
        only_functions = {name.strip() for name in args.functions.split(",") if name.strip()}

    try:
        source = args.file.read_text()
        has_tests = bool(extract_test_functions(source))
        count = evaluate_file(
            args.file.resolve(),
            force=args.force,
            workers=args.workers,
            batch_size=args.batch_size,
            only_functions=only_functions,
        )
    except (ValueError, OSError, SyntaxError) as exc:
        print(f"[TQS] {exc}", file=sys.stderr)
        sys.exit(1)
    if count == 0:
        if not has_tests:
            print("[TQS] No test functions found in file — nothing to evaluate.")
        else:
            print("[TQS] All functions are up to date — no changes detected.")


if __name__ == "__main__":
    main()
