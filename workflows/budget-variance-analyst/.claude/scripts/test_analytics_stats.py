#!/usr/bin/env python3
"""Compute TQS and generate the analytics dashboard.

Usage:
    python scripts/test_analytics_stats.py [--output docs/plots/tqs_dashboard.png]

Reads all sidecar JSON files from tests/.analytics/, computes the Test Quality
Score (TQS = mean(score/32)), prints a summary, and generates a 6-plot dashboard.

Dimension set (v2 — 8 dimensions, max score 32):
    structure_organization, contract_intent, isolation_determinism,
    scenario_breadth, execution_speed, maintainability,
    assertion_precision, edge_coverage

Backward compatibility: sidecar records written by the v1 evaluator use
coverage_signal/performance/maintenance as dimension keys. load_all_records()
normalizes these to the v2 names automatically.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).parent.parent.resolve()
ANALYTICS_DIR = REPO_ROOT / "tests" / ".analytics"
PLOTS_DIR = REPO_ROOT / "docs" / "plots"

sys.path.insert(0, str(Path(__file__).parent))
from _analytics_shared import (  # noqa: E402
    DIMENSIONS,
    PHASE_TO_DIM_DIST_GE1,
    PHASE_TO_DIM_DIST_GE1_EC,
    PHASE_TO_DIM_DIST_GE1_SB,
    PHASE_TO_DIM_DIST_GE2,
    PHASE_TO_DIM_DIST_GE2_EC,
    PHASE_TO_DIM_DIST_GE2_SB,
    PHASE_TO_DIM_DIST_GE3_COVERAGE,
    PHASE_TO_DIM_DIST_GE3_EC,
    PHASE_TO_DIM_DIST_GE3_OTHER,
    PHASE_TO_DIM_DIST_GE3_SB,
    PHASE_TO_FILE_AVG_FLOOR,
    PHASE_TO_TEST_SCORE_FLOOR,
    PHASE_TO_TQS_MINIMUM,
)

DIMENSION_LABELS = [
    "Structure &\nOrganization",
    "Contract\n& Intent",
    "Isolation &\nDeterminism",
    "Scenario\nBreadth",
    "Execution\nSpeed",
    "Maintainability",
    "Assertion\nPrecision",
    "Edge\nCoverage",
]

# Keys used in v1 sidecar records → v2 dimension names
_V1_TO_V2_DIM: dict[str, str] = {
    "coverage_signal": "scenario_breadth",
    "performance": "execution_speed",
    "maintenance": "maintainability",
}

# Light warm color palette (matches README color scheme)
BG_COLOR = "#f7f4ef"
PANEL_COLOR = "#ede9e1"
FG_COLOR = "#2a2a2a"
MUTED_COLOR = "#8a7f74"
ACCENT_COLOR = "#c9973a"
GRID_COLOR = "#ddd5c8"
BORDER_COLOR = "#c4b9ac"
SCORE_COLORS = ["#c0392b", "#d4700a", "#b89a0a", "#2d7a4a", "#1a5a35"]


def _current_phase() -> str | None:
    """Return the current project phase from project-meta.yaml, or None."""
    meta_path = REPO_ROOT / "project-meta.yaml"
    if not meta_path.exists():
        return None
    try:
        content = meta_path.read_text()
        m = re.search(r"^phase:\s*(\S+)", content, re.MULTILINE)
        if m:
            return m.group(1).strip()
    except OSError:
        pass
    return None


def current_phase_gates() -> dict[str, Any]:
    """Return all phase gate thresholds for the current phase, or empty dict."""
    phase = _current_phase()
    if phase is None:
        return {}
    return {
        "phase": phase,
        "tqs_min": PHASE_TO_TQS_MINIMUM.get(phase),
        "test_score_floor": PHASE_TO_TEST_SCORE_FLOOR.get(phase),
        "file_avg_floor": PHASE_TO_FILE_AVG_FLOOR.get(phase),
        "dim_floor": 1,  # always enforced
        "dim_dist_ge1": PHASE_TO_DIM_DIST_GE1.get(phase),
        "dim_dist_ge2": PHASE_TO_DIM_DIST_GE2.get(phase),
        "dim_dist_ge3_other": PHASE_TO_DIM_DIST_GE3_OTHER.get(phase),
        "dim_dist_ge3_coverage": PHASE_TO_DIM_DIST_GE3_COVERAGE.get(phase),
    }


def current_phase_minimum() -> float | None:
    """Return the TQS minimum for the current project phase, or None if unknown."""
    gates = current_phase_gates()
    return gates.get("tqs_min")


def _normalize_record(record: dict[str, Any]) -> dict[str, Any]:
    """Normalize a sidecar record to v2 dimension names.

    v1 records use coverage_signal / performance / maintenance as keys.
    v2 uses scenario_breadth / execution_speed / maintainability.
    Records missing assertion_precision or edge_coverage (new in v2) default to 0.
    """
    dims = record.get("dimensions", {})
    normalized = {_V1_TO_V2_DIM.get(k, k): v for k, v in dims.items()}
    # Ensure all 8 v2 dimensions present (new ones default to 0 until re-evaluated)
    for d in DIMENSIONS:
        normalized.setdefault(d, 0)
    return {**record, "dimensions": normalized}


def load_all_records() -> list[dict[str, Any]]:
    """Load all analytics records from sidecar files (walks subdirectories)."""
    records: list[dict[str, Any]] = []
    if not ANALYTICS_DIR.exists():
        return records
    for sidecar in sorted(ANALYTICS_DIR.rglob("*.json")):
        try:
            data = json.loads(sidecar.read_text())
        except (json.JSONDecodeError, OSError):
            continue
        records.extend(_normalize_record(r) for r in data.values() if isinstance(r, dict))
    return records


def compute_tqs(records: list[dict[str, Any]]) -> float:
    """TQS = mean(score/32). Equals AUC of the Quality Exceedance Curve.

    Max score is 32 (8 dimensions × 4). Records from the v1 evaluator (max 24)
    are normalized by load_all_records() before reaching this function.
    """
    if not records:
        return 0.0
    return float(sum(r["total_score"] / 32.0 for r in records) / len(records))


def exceedance_curve(records: list[dict[str, Any]]) -> tuple[list[float], list[float]]:
    """Compute CCDF of normalized scores. AUC of this curve == TQS."""
    normalized = sorted(r["total_score"] / 32.0 for r in records)
    n = len(normalized)
    xs = [i / 100 for i in range(101)]
    ys = [sum(1 for s in normalized if s >= t) / n for t in xs]
    return xs, ys


def module_dimension_matrix(records: list[dict[str, Any]]) -> tuple[list[str], list[list[float]]]:
    """Return (module_names, matrix[module_idx][dim_idx]) of mean scores."""
    module_scores: dict[str, list[list[float]]] = defaultdict(list)
    for r in records:
        fp = r.get("file_path", "unknown")
        # Use parent/stem for display to distinguish subdirectory files
        p = Path(fp)
        stem = f"{p.parent.name}/{p.stem}" if p.parent.name not in ("tests", ".") else p.stem
        dims = r.get("dimensions", {})
        row = [float(dims.get(d, 0)) for d in DIMENSIONS]
        module_scores[stem].append(row)

    modules = sorted(module_scores.keys())
    matrix = []
    for mod in modules:
        rows = module_scores[mod]
        n = len(rows)
        means = [sum(rows[i][j] for i in range(n)) / n for j in range(len(DIMENSIONS))]
        matrix.append(means)
    return modules, matrix


def _gate_status(ok: bool | None) -> str:
    """Return ✓ or ✗ (or — if unknown) for a gate result."""
    if ok is None:
        return "—"
    return "✓" if ok else "✗"


def generate_dashboard(
    records: list[dict[str, Any]],
    output_path: Path,
    phase_gates: dict[str, Any] | None = None,
    phase_minimum: float | None = None,
) -> None:
    """Generate the 7-plot TQS analytics dashboard.

    Layout: 2 rows × 4 columns. Column 4 is the quality heatmap spanning
    both rows. Column 2 row 1 is the dimension score frequency table.

    Args:
        records: All analytics records loaded from sidecar files.
        output_path: Destination path for the PNG file.
        phase_gates: Optional dict from current_phase_gates() containing
            phase, tqs_min, test_score_floor, file_avg_floor, dim_floor.
            When provided, gate requirement lines and pass/fail markers are
            overlaid on the relevant plots and the suptitle.
        phase_minimum: Shorthand for providing only a tqs_min gate line.
            Ignored when phase_gates is provided. Equivalent to passing
            phase_gates={"tqs_min": phase_minimum}.
    """
    if phase_gates is None and phase_minimum is not None:
        phase_gates = {"tqs_min": phase_minimum}
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.gridspec as gridspec
        import matplotlib.pyplot as plt
        import numpy as np
    except ImportError:
        print(
            "[TQS] matplotlib and numpy required for dashboard. Install with: pip install matplotlib numpy",
            file=sys.stderr,
        )
        sys.exit(1)

    if not records:
        print("[TQS] No analytics records found. Run 'make test-analytics' first.", file=sys.stderr)
        sys.exit(1)

    tqs = compute_tqs(records)
    xs_ec, ys_ec = exceedance_curve(records)
    modules, matrix = module_dimension_matrix(records)

    # --- Derive gate thresholds and evaluate pass/fail ---
    gates = phase_gates or {}
    phase = gates.get("phase")
    tqs_min: float | None = gates.get("tqs_min")
    test_floor: int | None = gates.get("test_score_floor")
    file_avg_floor: float | None = gates.get("file_avg_floor")
    dim_dist_ge1: float | None = gates.get("dim_dist_ge1")
    dim_dist_ge2: float | None = gates.get("dim_dist_ge2")
    dim_dist_ge3_other: float | None = gates.get("dim_dist_ge3_other")
    dim_dist_ge3_coverage: float | None = gates.get("dim_dist_ge3_coverage")

    n_records = len(records)

    dim_violations = sum(1 for r in records if any(r["dimensions"].get(d, 0) == 0 for d in DIMENSIONS))
    test_floor_violations = sum(1 for r in records if r["total_score"] < test_floor) if test_floor is not None else 0
    # Per-file average violations
    file_score_groups: dict[str, list[float]] = {}
    for r in records:
        stem = Path(r.get("file_path", "x")).stem
        file_score_groups.setdefault(stem, []).append(float(r["total_score"]))
    file_avg_violations = (
        sum(1 for scores in file_score_groups.values() if sum(scores) / len(scores) < file_avg_floor)
        if file_avg_floor is not None
        else 0
    )

    # Per-dimension actual fractions at each threshold level
    ge1_actuals = [sum(1 for r in records if r["dimensions"].get(d, 0) >= 1) / n_records for d in DIMENSIONS]
    ge2_actuals = [sum(1 for r in records if r["dimensions"].get(d, 0) >= 2) / n_records for d in DIMENSIONS]
    ge3_actuals = [sum(1 for r in records if r["dimensions"].get(d, 0) >= 3) / n_records for d in DIMENSIONS]
    # GE3 requirement is dim-specific: scenario_breadth and edge_coverage have lower ramps
    # (improving them requires writing new test scenarios — additive work)
    _SLOW_RAMP_DIMS = {"scenario_breadth", "edge_coverage"}
    [dim_dist_ge3_coverage if d in _SLOW_RAMP_DIMS else dim_dist_ge3_other for d in DIMENSIONS]

    # Per-dimension requirement vectors (built here for violation counting;
    # the plot also builds them independently using the three-tier tables)
    _SB_DIMS_EARLY = {"scenario_breadth"}
    _EC_DIMS_EARLY = {"edge_coverage"}

    def _per_dim_req(std_map: dict, sb_map: dict, ec_map: dict, dim: str, ph: str | None) -> float | None:
        if ph is None:
            return None
        if dim in _SB_DIMS_EARLY:
            return sb_map.get(ph)
        if dim in _EC_DIMS_EARLY:
            return ec_map.get(ph)
        return std_map.get(ph)

    ge1_reqs_early = [
        _per_dim_req(PHASE_TO_DIM_DIST_GE1, PHASE_TO_DIM_DIST_GE1_SB, PHASE_TO_DIM_DIST_GE1_EC, d, phase)
        for d in DIMENSIONS
    ]
    ge2_reqs_early = [
        _per_dim_req(PHASE_TO_DIM_DIST_GE2, PHASE_TO_DIM_DIST_GE2_SB, PHASE_TO_DIM_DIST_GE2_EC, d, phase)
        for d in DIMENSIONS
    ]
    ge3_reqs_early = [
        _per_dim_req(PHASE_TO_DIM_DIST_GE3_OTHER, PHASE_TO_DIM_DIST_GE3_SB, PHASE_TO_DIM_DIST_GE3_EC, d, phase)
        for d in DIMENSIONS
    ]

    dist_ge1_violations = sum(
        1 for a, req in zip(ge1_actuals, ge1_reqs_early, strict=False) if req is not None and a < req
    )
    dist_ge2_violations = sum(
        1 for a, req in zip(ge2_actuals, ge2_reqs_early, strict=False) if req is not None and a < req
    )
    dist_ge3_violations = sum(
        1 for a, req in zip(ge3_actuals, ge3_reqs_early, strict=False) if req is not None and a < req
    )
    total_dist_violations = dist_ge1_violations + dist_ge2_violations + dist_ge3_violations
    has_dist_gates = any(x is not None for x in [dim_dist_ge1, dim_dist_ge2, dim_dist_ge3_other])
    gate_dist_ok: bool | None = (total_dist_violations == 0) if has_dist_gates else None

    gate_dim_ok: bool = dim_violations == 0
    gate_tqs_ok: bool | None = (tqs >= tqs_min) if tqs_min is not None else None
    gate_test_ok: bool | None = (test_floor_violations == 0) if test_floor is not None else None
    gate_file_ok: bool | None = (file_avg_violations == 0) if file_avg_floor is not None else None

    # --- Build title + muted metadata subtitle ---
    base_title = f"Test Quality Dashboard  ·  {tqs:.0%} mean score  ·  {len(records):,} tests  ·  8 dims / max 32"
    if phase:
        gate_subtitle = (
            f"Phase: {phase}   "
            f"Dim≥1 {_gate_status(gate_dim_ok)}   "
            f"Per-test≥{test_floor} {_gate_status(gate_test_ok)}   "
            f"File avg≥{file_avg_floor} {_gate_status(gate_file_ok)}   "
            f"TQS≥{tqs_min:.0%} {_gate_status(gate_tqs_ok)}   "
            f"Dist {_gate_status(gate_dist_ok)}"
        )
    else:
        gate_subtitle = None

    # Warm sequential colormap replacing RdYlGn
    from matplotlib.colors import LinearSegmentedColormap

    LinearSegmentedColormap.from_list("warm_quality", ["#c0392b", "#d4700a", "#b89a0a", "#2d7a4a", "#1a5a35"], N=256)

    # --- Score frequency distribution per dimension (for table panel) ---
    freq_counts: list[list[int]] = []  # freq_counts[dim_idx][score 0..4]
    for d in DIMENSIONS:
        freq_counts.append([sum(1 for r in records if r["dimensions"].get(d, 0) == s) for s in range(5)])

    fig = plt.figure(figsize=(30, 14), facecolor=BG_COLOR)
    fig.suptitle(base_title, fontsize=13, fontweight="bold", color=FG_COLOR, y=0.995)
    if gate_subtitle:
        fig.text(0.5, 0.972, gate_subtitle, ha="center", va="top", fontsize=8.5, color=MUTED_COLOR)

    # 2-row × 4-col grid; column 4 (index 3) hosts heatmap spanning both rows
    gs = gridspec.GridSpec(
        2,
        4,
        figure=fig,
        left=0.03,
        right=0.99,
        top=0.935,
        bottom=0.08,
        wspace=0.38,
        hspace=0.40,
        width_ratios=[1, 1.1, 1, 2.8],
    )

    # ----- Plot 1: Radar chart (mean score per dimension) -----
    ax1 = fig.add_subplot(gs[0, 0], polar=True, facecolor=PANEL_COLOR)
    mean_scores = [sum(r["dimensions"].get(d, 0) for r in records) / len(records) for d in DIMENSIONS]
    angles = np.linspace(0, 2 * np.pi, len(DIMENSIONS), endpoint=False).tolist()
    angles += angles[:1]
    values = mean_scores + mean_scores[:1]

    ax1.set_facecolor(PANEL_COLOR)
    ax1.plot(angles, values, color=ACCENT_COLOR, linewidth=2.5)
    ax1.fill(angles, values, color=ACCENT_COLOR, alpha=0.35)
    # Dimension floor ring: score=1 is the absolute minimum (all phases)
    floor_ring = [1.0] * (len(DIMENSIONS) + 1)
    ax1.plot(
        angles,
        floor_ring,
        color=SCORE_COLORS[0],
        linewidth=1.2,
        linestyle="--",
        alpha=0.7,
        label="Dim floor = 1",
    )
    _RADAR_LABELS = ["Struct.", "Contract", "Isolation", "Breadth", "Speed", "Maint.", "Precision", "Edge"]
    ax1.set_xticks(angles[:-1])
    ax1.set_xticklabels(_RADAR_LABELS, size=8, color=FG_COLOR)
    ax1.set_ylim(0, 4)
    ax1.set_yticks([1, 2, 3, 4])
    ax1.set_yticklabels(["1", "2", "3", "4"], size=7, color=MUTED_COLOR)
    ax1.grid(color=GRID_COLOR)
    ax1.spines["polar"].set_color(BORDER_COLOR)
    dim_status = f"  {_gate_status(gate_dim_ok)} {dim_violations} violations" if phase else ""
    ax1.set_title(
        f"Dimension Radar\n(mean score per dimension){dim_status}",
        pad=15,
        fontsize=10,
        color=FG_COLOR,
        fontweight="bold",
    )
    ax1.legend(
        fontsize=7,
        facecolor=PANEL_COLOR,
        edgecolor=BORDER_COLOR,
        labelcolor=FG_COLOR,
        loc="upper right",
        bbox_to_anchor=(1.35, 1.1),
    )

    # ----- Plot 2: Dimension score frequency distribution table -----
    ax2 = fig.add_subplot(gs[0, 1])
    ax2.set_facecolor(PANEL_COLOR)
    ax2.set_axis_off()

    # Table data: rows = dimensions, cols = score 0..4
    short_dim_labels = ["Structure", "Contract", "Isolation", "Breadth", "Speed", "Maintain.", "Precision", "Edge"]
    score_col_labels = ["0", "1", "2", "3", "4"]

    # Cell background colors: map score column to color (score 0=red .. 4=green)
    col_bg_colors = [
        "#f5d0cc",  # score=0 light red
        "#fde8c8",  # score=1 light amber
        "#faf5c0",  # score=2 light yellow
        "#d4edda",  # score=3 light green
        "#a8d5b5",  # score=4 deeper green
    ]

    # Build cell text: "XX.X%\n(N)"
    cell_text = []
    cell_colors = []
    for dim_idx in range(len(DIMENSIONS)):
        row_text = []
        row_colors = []
        for s in range(5):
            n = freq_counts[dim_idx][s]
            pct = 100.0 * n / n_records
            row_text.append(f"{pct:.1f}%\n({n:,})")
            row_colors.append(col_bg_colors[s])
        cell_text.append(row_text)
        cell_colors.append(row_colors)

    tbl = ax2.table(
        cellText=cell_text,
        rowLabels=short_dim_labels,
        colLabels=score_col_labels,
        cellLoc="center",
        rowLoc="right",
        loc="center",
        cellColours=cell_colors,
    )
    tbl.auto_set_font_size(False)
    tbl.auto_set_column_width(col=list(range(-1, 5)))

    # Style header and row-label cells
    for (row, col), cell in tbl.get_celld().items():
        cell.set_edgecolor(BORDER_COLOR)
        cell.set_linewidth(0.6)
        if row == 0:
            # Column headers
            cell.set_facecolor(PANEL_COLOR)
            cell.set_text_props(color=FG_COLOR, fontweight="bold", fontsize=7)
            cell.set_height(0.09)
        elif col == -1:
            # Row labels (dimension names)
            cell.set_facecolor(PANEL_COLOR)
            cell.set_text_props(color=FG_COLOR, fontweight="bold", fontsize=7)
        else:
            cell.set_text_props(color=FG_COLOR, fontsize=7)
            # Taller data rows to fit the two-line text
            cell.set_height(0.11)

    ax2.set_title(
        "Score Frequency Distribution\n(% of tests per dimension × score)",
        fontsize=10,
        color=FG_COLOR,
        fontweight="bold",
        pad=8,
    )

    # ----- Plot 3: Test Signal vs Test Craft scatter with quadrants -----
    ax3 = fig.add_subplot(gs[0, 2], facecolor=PANEL_COLOR)

    # X = avg(scenario_breadth, edge_coverage) — how well tests probe the space
    # Y = avg of remaining 6 craft dims — how well the tests are written
    _SIGNAL_DIMS = {"scenario_breadth", "edge_coverage"}
    _CRAFT_DIMS = [d for d in DIMENSIONS if d not in _SIGNAL_DIMS]

    mod_signal: dict[str, list[float]] = {}
    mod_craft: dict[str, list[float]] = {}
    for r in records:
        stem = Path(r.get("file_path", "x")).stem.replace("test_", "")
        sig = (r["dimensions"].get("scenario_breadth", 0) + r["dimensions"].get("edge_coverage", 0)) / 8.0
        craft = sum(r["dimensions"].get(d, 0) for d in _CRAFT_DIMS) / (4.0 * len(_CRAFT_DIMS))
        mod_signal.setdefault(stem, []).append(sig)
        mod_craft.setdefault(stem, []).append(craft)

    xs_scatter = [sum(v) / len(v) for v in mod_signal.values()]
    ys_scatter = [sum(v) / len(v) for v in mod_craft.values()]

    x_split = float(np.median(xs_scatter)) if xs_scatter else 0.5
    y_split = float(np.median(ys_scatter)) if ys_scatter else 0.5
    ax3.axhline(y_split, color=BORDER_COLOR, linewidth=1, linestyle="--", alpha=0.6)
    ax3.axvline(x_split, color=BORDER_COLOR, linewidth=1, linestyle="--", alpha=0.6)

    for x, y in zip(xs_scatter, ys_scatter, strict=False):
        color = SCORE_COLORS[min(int(y * 4), 4)]
        ax3.scatter(x, y, color=color, s=90, zorder=3, alpha=0.50, edgecolors=color, linewidths=0.7)

    # Quadrant labels
    ax3.text(
        0.25,
        0.87,
        "Polished",
        transform=ax3.transAxes,
        fontsize=8,
        color=MUTED_COLOR,
        ha="center",
        va="center",
        fontweight="bold",
    )
    ax3.text(
        0.25,
        0.80,
        "narrow probe, strong craft",
        transform=ax3.transAxes,
        fontsize=6,
        color=MUTED_COLOR,
        ha="center",
        va="center",
        style="italic",
    )
    ax3.text(
        0.75,
        0.87,
        "Thorough",
        transform=ax3.transAxes,
        fontsize=8,
        color=FG_COLOR,
        ha="center",
        va="center",
        fontweight="bold",
    )
    ax3.text(
        0.75,
        0.80,
        "wide probe, strong craft",
        transform=ax3.transAxes,
        fontsize=6,
        color=MUTED_COLOR,
        ha="center",
        va="center",
        style="italic",
    )
    ax3.text(
        0.25,
        0.17,
        "Sparse",
        transform=ax3.transAxes,
        fontsize=8,
        color="#c0392b",
        ha="center",
        va="center",
        fontweight="bold",
    )
    ax3.text(
        0.25,
        0.10,
        "narrow probe, weak craft",
        transform=ax3.transAxes,
        fontsize=6,
        color=MUTED_COLOR,
        ha="center",
        va="center",
        style="italic",
    )
    ax3.text(
        0.75,
        0.17,
        "Scattered",
        transform=ax3.transAxes,
        fontsize=8,
        color="#d4700a",
        ha="center",
        va="center",
        fontweight="bold",
    )
    ax3.text(
        0.75,
        0.10,
        "wide probe, weak craft",
        transform=ax3.transAxes,
        fontsize=6,
        color=MUTED_COLOR,
        ha="center",
        va="center",
        style="italic",
    )

    ax3.set_xlabel("How well the tests probe", fontsize=8, color=MUTED_COLOR)
    ax3.set_ylabel("How well the tests are written", fontsize=8, color=MUTED_COLOR)
    ax3.set_xlim(-0.05, 1.05)
    ax3.set_ylim(-0.05, 1.05)
    ax3.tick_params(colors=MUTED_COLOR)
    ax3.set_facecolor(PANEL_COLOR)
    for spine in ax3.spines.values():
        spine.set_color(BORDER_COLOR)
    ax3.set_title("Test Signal vs Test Craft\n(per module)", fontsize=10, color=FG_COLOR, fontweight="bold")

    # ----- Plot 4: Distribution Gate Compliance — Cleveland dot plot -----
    ax4 = fig.add_subplot(gs[1, 0], facecolor=PANEL_COLOR)
    short_labels = ["Structure", "Contract", "Isolation", "Breadth", "Speed", "Maintainability", "Precision", "Edge"]

    # Per-dimension requirement vectors using three-tier lookup
    _SB_DIMS = {"scenario_breadth"}
    _EC_DIMS = {"edge_coverage"}

    def _dim_req(std: dict, sb: dict, ec: dict, dim: str, ph: str | None) -> float | None:
        if ph is None:
            return None
        if dim in _SB_DIMS:
            return sb.get(ph)
        if dim in _EC_DIMS:
            return ec.get(ph)
        return std.get(ph)

    ge1_reqs_per_dim = [
        _dim_req(PHASE_TO_DIM_DIST_GE1, PHASE_TO_DIM_DIST_GE1_SB, PHASE_TO_DIM_DIST_GE1_EC, d, phase)
        for d in DIMENSIONS
    ]
    ge2_reqs_per_dim = [
        _dim_req(PHASE_TO_DIM_DIST_GE2, PHASE_TO_DIM_DIST_GE2_SB, PHASE_TO_DIM_DIST_GE2_EC, d, phase)
        for d in DIMENSIONS
    ]
    ge3_reqs_per_dim = [
        _dim_req(PHASE_TO_DIM_DIST_GE3_OTHER, PHASE_TO_DIM_DIST_GE3_SB, PHASE_TO_DIM_DIST_GE3_EC, d, phase)
        for d in DIMENSIONS
    ]

    # Layout: one row per dimension; three dot lanes offset by dy
    n_dims = len(DIMENSIONS)
    y_centers = np.arange(n_dims, dtype=float)
    dy = 0.25  # vertical offset between the three threshold lanes
    DOT_SIZE = 72
    DOT_ALPHA = 0.92

    # Lighter tints for floor diamonds — match threshold hue but softer
    LIGHT_GE1 = "#f5d9a8"  # light orange  (tint of SCORE_COLORS[1] #d4700a)
    LIGHT_GE2 = "#f0e8a0"  # light yellow  (tint of SCORE_COLORS[2] #b89a0a)
    LIGHT_GE3 = "#a8d5b5"  # light green   (tint of SCORE_COLORS[3] #2d7a4a)

    # Threshold config: actuals, reqs, y-offset, dot color, diamond fill, label
    thresholds = [
        (ge1_actuals, ge1_reqs_per_dim, dy, SCORE_COLORS[1], LIGHT_GE1, "≥1"),
        (ge2_actuals, ge2_reqs_per_dim, 0.0, SCORE_COLORS[2], LIGHT_GE2, "≥2"),
        (ge3_actuals, ge3_reqs_per_dim, -dy, SCORE_COLORS[3], LIGHT_GE3, "≥3"),
    ]

    # Alternating row bands (drawn first so everything sits on top)
    for i in range(n_dims):
        if i % 2 == 0:
            ax4.axhspan(i - 0.5, i + 0.5, color=GRID_COLOR, alpha=0.35, linewidth=0)

    # Thick dividers between each dimension row
    for i in range(n_dims - 1):
        ax4.axhline(i + 0.5, color=BORDER_COLOR, linewidth=1.8, zorder=2, alpha=0.55)

    # Per-row spine: horizontal line spanning all three actual dots
    for i in range(n_dims):
        x_lo = min(ge3_actuals[i], ge2_actuals[i], ge1_actuals[i]) * 100
        x_hi = max(ge3_actuals[i], ge2_actuals[i], ge1_actuals[i]) * 100
        ax4.plot(
            [x_lo, x_hi],
            [y_centers[i]] * 2,
            color=BORDER_COLOR,
            linewidth=1.4,
            zorder=2,
            alpha=0.45,
            solid_capstyle="round",
        )

    # Dots + floor diamonds + dashed connector from diamond to actual
    for actuals, reqs, offset, color, light_color, label in thresholds:
        ys = y_centers + offset
        xs = [a * 100 for a in actuals]

        # Dashed line from floor diamond to actual dot
        for i, req in enumerate(reqs):
            if req is not None:
                ax4.plot(
                    [req * 100, xs[i]],
                    [ys[i]] * 2,
                    color=color,
                    linewidth=1.8,
                    zorder=3,
                    alpha=0.60,
                    linestyle="--",
                    solid_capstyle="round",
                )

        # Actual dots
        ax4.scatter(
            xs,
            ys,
            s=DOT_SIZE,
            color=color,
            zorder=5,
            alpha=DOT_ALPHA,
            edgecolors=BORDER_COLOR,
            linewidths=0.5,
            label=label,
        )

        # Floor diamonds — light tint fill, colored edge matching threshold
        for i, req in enumerate(reqs):
            if req is not None:
                ax4.scatter(
                    req * 100,
                    ys[i],
                    s=DOT_SIZE * 0.62,
                    marker="D",
                    color=light_color,
                    edgecolors=color,
                    linewidths=1.4,
                    zorder=4,
                    alpha=0.95,
                )

    ax4.set_yticks(y_centers)
    ax4.set_yticklabels(short_labels, fontsize=8.5, color=FG_COLOR)
    ax4.set_xlabel("% of tests at threshold", fontsize=8, color=MUTED_COLOR)
    ax4.set_xlim(-2, 108)
    ax4.set_ylim(-0.6, n_dims - 0.4)
    ax4.tick_params(axis="x", colors=MUTED_COLOR, labelsize=7)
    ax4.tick_params(axis="y", length=0)
    ax4.set_facecolor(PANEL_COLOR)
    for spine in ax4.spines.values():
        spine.set_visible(False)
    ax4.xaxis.grid(True, color=GRID_COLOR, linewidth=0.5, zorder=1)
    ax4.set_axisbelow(True)

    # Legend — actual dots + matching-tint diamonds for floor
    from matplotlib.lines import Line2D

    legend_elements = [
        Line2D(
            [0],
            [0],
            marker="o",
            color="w",
            markerfacecolor=SCORE_COLORS[1],
            markersize=7,
            markeredgecolor=BORDER_COLOR,
            markeredgewidth=0.5,
            label="≥1 actual",
        ),
        Line2D(
            [0],
            [0],
            marker="D",
            color="w",
            markerfacecolor=LIGHT_GE1,
            markersize=6,
            markeredgecolor=SCORE_COLORS[1],
            markeredgewidth=1.3,
            label="≥1 floor",
        ),
        Line2D(
            [0],
            [0],
            marker="o",
            color="w",
            markerfacecolor=SCORE_COLORS[2],
            markersize=7,
            markeredgecolor=BORDER_COLOR,
            markeredgewidth=0.5,
            label="≥2 actual",
        ),
        Line2D(
            [0],
            [0],
            marker="D",
            color="w",
            markerfacecolor=LIGHT_GE2,
            markersize=6,
            markeredgecolor=SCORE_COLORS[2],
            markeredgewidth=1.3,
            label="≥2 floor",
        ),
        Line2D(
            [0],
            [0],
            marker="o",
            color="w",
            markerfacecolor=SCORE_COLORS[3],
            markersize=7,
            markeredgecolor=BORDER_COLOR,
            markeredgewidth=0.5,
            label="≥3 actual",
        ),
        Line2D(
            [0],
            [0],
            marker="D",
            color="w",
            markerfacecolor=LIGHT_GE3,
            markersize=6,
            markeredgecolor=SCORE_COLORS[3],
            markeredgewidth=1.3,
            label="≥3 floor",
        ),
    ]
    ax4.legend(
        handles=legend_elements,
        fontsize=7,
        facecolor=PANEL_COLOR,
        edgecolor=BORDER_COLOR,
        labelcolor=FG_COLOR,
        loc="upper center",
        bbox_to_anchor=(0.5, -0.13),
        ncol=6,
        framealpha=0.9,
        handletextpad=0.4,
        columnspacing=0.8,
    )
    dist_badge = f"  {_gate_status(gate_dist_ok)} {total_dist_violations} failing" if phase else ""
    ax4.set_title(
        f"Distribution Gate Compliance{dist_badge}",
        fontsize=10,
        color=FG_COLOR,
        fontweight="bold",
    )

    # ----- Plot 5: Quality Exceedance Curve (CCDF) -----
    ax5 = fig.add_subplot(gs[1, 1], facecolor=PANEL_COLOR)
    ax5.plot(xs_ec, ys_ec, color=ACCENT_COLOR, linewidth=2.5)
    ax5.fill_between(xs_ec, ys_ec, alpha=0.2, color=ACCENT_COLOR, label=f"AUC = mean score = {tqs:.1%}")

    # Phase TQS floor (vertical line — threshold on X axis)
    if tqs_min is not None:
        ax5.axvline(
            tqs_min,
            color=SCORE_COLORS[0],
            linewidth=1.5,
            linestyle="--",
            label=f"TQS gate = {tqs_min:.0%}",
        )
        status_color = SCORE_COLORS[4] if gate_tqs_ok else SCORE_COLORS[0]
        ax5.annotate(
            f"{_gate_status(gate_tqs_ok)} TQS {tqs:.0%}",
            xy=(tqs_min, 0.06),
            fontsize=8,
            color=status_color,
            ha="left",
            bbox={"boxstyle": "round,pad=0.25", "facecolor": PANEL_COLOR, "edgecolor": "none", "alpha": 0.85},
        )

    # Per-test score floor (vertical line at floor/32)
    if test_floor is not None:
        test_floor_norm = test_floor / 32.0
        ax5.axvline(
            test_floor_norm,
            color="#d4700a",
            linewidth=1.2,
            linestyle="-.",
            label=f"Per-test floor = {test_floor}/32 ({test_floor_norm:.0%})",
        )
        floor_status_color = SCORE_COLORS[4] if gate_test_ok else SCORE_COLORS[0]
        ax5.annotate(
            f"{_gate_status(gate_test_ok)} {test_floor_violations} fail",
            xy=(test_floor_norm, 0.94),
            fontsize=8,
            color=floor_status_color,
            ha="right",
            bbox={"boxstyle": "round,pad=0.25", "facecolor": PANEL_COLOR, "edgecolor": "none", "alpha": 0.85},
        )

    ax5.axhline(tqs, color=MUTED_COLOR, linewidth=0.8, linestyle=":")

    ax5.set_xlabel("Normalized Score Threshold", fontsize=8, color=MUTED_COLOR)
    ax5.set_ylabel("Fraction of Tests >= threshold", fontsize=8, color=MUTED_COLOR)
    ax5.set_xlim(0, 1)
    ax5.set_ylim(0, 1.05)
    ax5.tick_params(colors=MUTED_COLOR)
    ax5.set_facecolor(PANEL_COLOR)
    for spine in ax5.spines.values():
        spine.set_color(BORDER_COLOR)
    ax5.grid(color=GRID_COLOR, linewidth=0.5)
    ax5.legend(fontsize=8, facecolor=PANEL_COLOR, edgecolor=BORDER_COLOR, labelcolor=FG_COLOR)
    ax5.set_title(
        "Quality Exceedance Curve\n(CCDF of normalized scores; AUC = mean score)",
        fontsize=10,
        color=FG_COLOR,
        fontweight="bold",
    )

    # ----- Plot 6: CDF of total scores (0–32) -----
    ax6 = fig.add_subplot(gs[1, 2], facecolor=PANEL_COLOR)
    all_scores = sorted(r["total_score"] for r in records)
    n = len(all_scores)
    # Build step CDF: for each integer score 0..32, fraction of tests <= score
    score_range = list(range(33))
    cdf_vals = [sum(1 for s in all_scores if s <= t) / n for t in score_range]

    ax6.step(score_range, cdf_vals, where="post", color=ACCENT_COLOR, linewidth=2.5)
    ax6.fill_between(score_range, cdf_vals, step="post", alpha=0.18, color=ACCENT_COLOR)

    # Per-test score floor (vertical line)
    if test_floor is not None:
        ax6.axvline(
            test_floor,
            color=SCORE_COLORS[0],
            linewidth=1.5,
            linestyle="--",
            label=f"Per-test floor = {test_floor}",
        )
        # Fraction below floor (failing)
        frac_below = sum(1 for s in all_scores if s < test_floor) / n
        status_color = SCORE_COLORS[4] if gate_test_ok else SCORE_COLORS[0]
        ax6.annotate(
            f"{_gate_status(gate_test_ok)} {frac_below:.0%} below floor",
            xy=(test_floor, 0.5),
            xytext=(test_floor + 0.8, 0.5),
            fontsize=8,
            color=status_color,
            va="center",
            bbox={"boxstyle": "round,pad=0.25", "facecolor": PANEL_COLOR, "edgecolor": "none", "alpha": 0.85},
        )

    # Median line
    median_score = all_scores[n // 2]
    ax6.axvline(median_score, color=MUTED_COLOR, linewidth=0.9, linestyle=":", label=f"Median = {median_score}")

    ax6.set_xlabel("Total Score (0–32)", fontsize=8, color=MUTED_COLOR)
    ax6.set_ylabel("Cumulative Fraction of Tests", fontsize=8, color=MUTED_COLOR)
    ax6.set_xlim(0, 32)
    ax6.set_ylim(0, 1.05)
    ax6.tick_params(colors=MUTED_COLOR)
    ax6.set_facecolor(PANEL_COLOR)
    for spine in ax6.spines.values():
        spine.set_color(BORDER_COLOR)
    ax6.grid(color=GRID_COLOR, linewidth=0.5)
    ax6.legend(fontsize=7, facecolor=PANEL_COLOR, edgecolor=BORDER_COLOR, labelcolor=FG_COLOR)
    ax6.set_title(
        "Score CDF\n(cumulative distribution, max 32)",
        fontsize=10,
        color=FG_COLOR,
        fontweight="bold",
    )

    # ----- Plot 7: Module Quality Scatter (percentile rank scatter) -----
    ax7 = fig.add_subplot(gs[:, 3])
    ax7.set_facecolor(PANEL_COLOR)

    _XLIM = (-0.1, 4.3)
    _YLIM = (-0.1, 4.3)

    if modules and matrix:
        n_mods = len(modules)

        # Per-module raw scores
        mod_mean_tqs_vals = [sum(row) / len(row) for row in matrix]
        mod_worst_dim_vals = [min(row) for row in matrix]

        # Per-module violation count: tests with at least one dimension scored 0
        _mod_viol: dict[str, int] = {}
        for r in records:
            p = Path(r.get("file_path", "unknown"))
            _stem = f"{p.parent.name}/{p.stem}" if p.parent.name not in ("tests", ".") else p.stem
            if any(r["dimensions"].get(d, 0) == 0 for d in DIMENSIONS):
                _mod_viol[_stem] = _mod_viol.get(_stem, 0) + 1
        mod_violations_list = [_mod_viol.get(m, 0) for m in modules]

        # Quadrant splits: X = phase-based TQS target, Y = absolute gate floor
        _phase = _current_phase()
        _tqs_frac = PHASE_TO_TQS_MINIMUM.get(_phase or "", 0.50)
        x_split = _tqs_frac * 4  # 0–1 fraction → 0–4 scale
        y_split = 1.0  # gate floor: worst-dim average must be ≥ 1.0

        # Dot colors by violation count
        _viol_colors = [
            SCORE_COLORS[4] if v == 0 else (SCORE_COLORS[2] if v == 1 else SCORE_COLORS[0]) for v in mod_violations_list
        ]

        # Quadrant background shading (subtle — only Fragile/Critical corners)
        _xfrac = (x_split - _XLIM[0]) / (_XLIM[1] - _XLIM[0])
        ax7.axhspan(y_split, _YLIM[1], xmin=_xfrac, xmax=1.0, color=SCORE_COLORS[4], alpha=0.04)
        ax7.axhspan(_YLIM[0], y_split, xmin=_xfrac, xmax=1.0, color=SCORE_COLORS[0], alpha=0.05)

        # Quadrant dividers
        ax7.axhline(y_split, color=BORDER_COLOR, linewidth=1.1, linestyle="--", alpha=0.65)
        ax7.axvline(x_split, color=BORDER_COLOR, linewidth=1.1, linestyle="--", alpha=0.65)

        # Dots (raw scores directly on axes)
        ax7.scatter(
            mod_mean_tqs_vals,
            mod_worst_dim_vals,
            c=_viol_colors,
            s=70,
            zorder=3,
            alpha=0.80,
            edgecolors=BORDER_COLOR,
            linewidths=0.5,
        )

        # Quadrant labels (axes-fraction coords, always in corners)
        _quads = [
            (0.25, 0.93, "Uniform", MUTED_COLOR, "consistent but weak overall"),
            (0.75, 0.93, "Consistent", SCORE_COLORS[4], "strong across the board"),
            (0.25, 0.07, "Critical", SCORE_COLORS[0], "needs most attention"),
            (0.75, 0.07, "Fragile", "#d4700a", "strong average hides a gap"),
        ]
        for qx, qy, qlabel, qcolor, qsub in _quads:
            ax7.text(
                qx,
                qy,
                qlabel,
                transform=ax7.transAxes,
                fontsize=8,
                color=qcolor,
                ha="center",
                va="center",
                fontweight="bold",
            )
            ax7.text(
                qx,
                qy - 0.055,
                qsub,
                transform=ax7.transAxes,
                fontsize=6,
                color=MUTED_COLOR,
                ha="center",
                va="center",
                style="italic",
            )

        # Annotate Critical and Fragile modules (worst-dim below gate floor)
        _label_indices = [i for i in range(n_mods) if mod_worst_dim_vals[i] < y_split]
        _offset_cycle = [
            (6, 4),
            (-6, 4),
            (6, -8),
            (-6, -8),
            (10, 0),
            (-10, 0),
            (4, 10),
            (4, -12),
        ]
        for _li, i in enumerate(_label_indices):
            _ox, _oy = _offset_cycle[_li % len(_offset_cycle)]
            ax7.annotate(
                modules[i],
                (mod_mean_tqs_vals[i], mod_worst_dim_vals[i]),
                textcoords="offset points",
                xytext=(_ox, _oy),
                fontsize=5.5,
                color=MUTED_COLOR,
                arrowprops={"arrowstyle": "-", "color": MUTED_COLOR, "lw": 0.5, "alpha": 0.5},
                bbox={"boxstyle": "round,pad=0.15", "facecolor": BG_COLOR, "edgecolor": "none", "alpha": 0.80},
            )

        # Legend
        from matplotlib.lines import Line2D

        _leg = [
            Line2D(
                [0],
                [0],
                marker="o",
                color="w",
                markerfacecolor=SCORE_COLORS[4],
                markersize=7,
                markeredgecolor=BORDER_COLOR,
                markeredgewidth=0.5,
                label="No violations",
            ),
            Line2D(
                [0],
                [0],
                marker="o",
                color="w",
                markerfacecolor=SCORE_COLORS[2],
                markersize=7,
                markeredgecolor=BORDER_COLOR,
                markeredgewidth=0.5,
                label="1 violation",
            ),
            Line2D(
                [0],
                [0],
                marker="o",
                color="w",
                markerfacecolor=SCORE_COLORS[0],
                markersize=7,
                markeredgecolor=BORDER_COLOR,
                markeredgewidth=0.5,
                label="2+ violations",
            ),
        ]
        ax7.legend(
            handles=_leg,
            fontsize=7,
            facecolor=PANEL_COLOR,
            edgecolor=BORDER_COLOR,
            labelcolor=FG_COLOR,
            loc="lower right",
        )
    else:
        n_mods = 0
        _phase = _current_phase()
        x_split = PHASE_TO_TQS_MINIMUM.get(_phase or "", 0.50) * 4
        y_split = 1.0
        ax7.text(0.5, 0.5, "No module data", ha="center", va="center", transform=ax7.transAxes, color=MUTED_COLOR)

    _phase_label = f"phase target: {x_split:.2f}" if _phase else f"default target: {x_split:.2f}"
    ax7.set_xlabel(
        f"Mean score per module (0–4) — {_phase_label}",
        fontsize=8,
        color=MUTED_COLOR,
    )
    ax7.set_ylabel(
        "Worst dimension score (0–4) — gate floor: 1.0",
        fontsize=8,
        color=MUTED_COLOR,
    )
    ax7.set_xlim(*_XLIM)
    ax7.set_ylim(*_YLIM)
    ax7.tick_params(colors=MUTED_COLOR, labelsize=7)
    ax7.set_facecolor(PANEL_COLOR)
    for spine in ax7.spines.values():
        spine.set_color(BORDER_COLOR)
    ax7.grid(color=GRID_COLOR, linewidth=0.5, alpha=0.5, zorder=0)
    ax7.set_title(
        f"Module Quality Scatter — {n_mods} modules\nmean score vs worst dimension score",
        fontsize=10,
        color=FG_COLOR,
        fontweight="bold",
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=150, bbox_inches="tight", facecolor=BG_COLOR)
    plt.close(fig)
    try:
        display = output_path.relative_to(REPO_ROOT)
    except ValueError:
        display = output_path
    print(f"[TQS] Dashboard written to {display}")


def generate_individual_plots(
    records: list[dict[str, Any]],
    output_dir: Path,
) -> None:
    """Generate three standalone transparent-background plots.

    1. tqs_freq_dist.png   — score frequency distribution (colored table)
    2. tqs_signal_quality.png — test signal vs test quality scatter
    3. tqs_cdf.png          — score CDF with X axis as % of max score
    """
    try:
        import matplotlib.pyplot as plt
        import numpy as np
    except ImportError:
        print("[TQS] matplotlib not available — skipping individual plot generation")
        return

    output_dir.mkdir(parents=True, exist_ok=True)
    n_records = len(records)

    # Pre-compute frequency counts (dim × score 0..4)
    freq_counts: list[list[int]] = [[0] * 5 for _ in DIMENSIONS]
    for r in records:
        for di, d in enumerate(DIMENSIONS):
            s = int(r["dimensions"].get(d, 0))
            if 0 <= s <= 4:
                freq_counts[di][s] += 1

    # ---- Plot 1: Score frequency distribution --------------------------------
    col_bg_colors = ["#f5d0cc", "#fde8c8", "#faf5c0", "#d4edda", "#a8d5b5"]
    short_dim_labels = ["Structure", "Contract", "Isolation", "Breadth", "Speed", "Maintain.", "Precision", "Edge"]
    score_col_labels = ["0", "1", "2", "3", "4"]

    cell_text = []
    cell_colors = []
    for di in range(len(DIMENSIONS)):
        row_text = []
        row_colors = []
        for s in range(5):
            n = freq_counts[di][s]
            pct = 100.0 * n / n_records if n_records else 0.0
            row_text.append(f"{pct:.1f}%\n({n:,})")
            row_colors.append(col_bg_colors[s])
        cell_text.append(row_text)
        cell_colors.append(row_colors)

    fig1, ax = plt.subplots(figsize=(12, 4))
    fig1.patch.set_facecolor(BG_COLOR)
    ax.set_facecolor(BG_COLOR)
    ax.set_axis_off()

    tbl = ax.table(
        cellText=cell_text,
        rowLabels=short_dim_labels,
        colLabels=score_col_labels,
        cellLoc="center",
        rowLoc="right",
        loc="center",
        cellColours=cell_colors,
    )
    tbl.auto_set_font_size(False)
    # Set explicit column widths: narrow row-label column, wide score columns
    for (row, col), cell in tbl.get_celld().items():
        if col == -1:
            cell.set_width(0.12)
        else:
            cell.set_width(0.18)
    for (row, col), cell in tbl.get_celld().items():
        cell.set_edgecolor(BORDER_COLOR)
        cell.set_linewidth(0.6)
        if row == 0:
            cell.set_facecolor(PANEL_COLOR)
            cell.set_text_props(color=FG_COLOR, fontweight="bold", fontsize=9)
            cell.set_height(0.09)
        elif col == -1:
            cell.set_facecolor(PANEL_COLOR)
            cell.set_text_props(color=FG_COLOR, fontweight="bold", fontsize=9)
        else:
            cell.set_text_props(color=FG_COLOR, fontsize=9)
            cell.set_height(0.11)

    ax.set_title(
        "Score Frequency Distribution — % of tests per dimension × score",
        fontsize=11,
        color=FG_COLOR,
        fontweight="bold",
        pad=10,
    )
    p1 = output_dir / "tqs_freq_dist.png"
    fig1.savefig(p1, dpi=150, bbox_inches="tight", facecolor=BG_COLOR)
    plt.close(fig1)
    print(f"[TQS] Written {p1.relative_to(REPO_ROOT)}")

    # ---- Plot 2: Test signal vs test quality scatter -------------------------
    _SIGNAL_DIMS = {"scenario_breadth", "edge_coverage"}
    _CRAFT_DIMS = [d for d in DIMENSIONS if d not in _SIGNAL_DIMS]

    mod_signal: dict[str, list[float]] = {}
    mod_craft: dict[str, list[float]] = {}
    for r in records:
        stem = Path(r.get("file_path", "x")).stem.replace("test_", "")
        sig = (r["dimensions"].get("scenario_breadth", 0) + r["dimensions"].get("edge_coverage", 0)) / 8.0
        craft = sum(r["dimensions"].get(d, 0) for d in _CRAFT_DIMS) / (4.0 * len(_CRAFT_DIMS))
        mod_signal.setdefault(stem, []).append(sig)
        mod_craft.setdefault(stem, []).append(craft)

    xs_s = [sum(v) / len(v) for v in mod_signal.values()]
    ys_s = [sum(v) / len(v) for v in mod_craft.values()]

    fig2, ax2 = plt.subplots(figsize=(6, 5))
    fig2.patch.set_facecolor(BG_COLOR)
    ax2.set_facecolor(BG_COLOR)

    x_split = float(np.median(xs_s)) if xs_s else 0.5
    y_split = float(np.median(ys_s)) if ys_s else 0.5
    ax2.axhline(y_split, color=BORDER_COLOR, linewidth=1, linestyle="--", alpha=0.6)
    ax2.axvline(x_split, color=BORDER_COLOR, linewidth=1, linestyle="--", alpha=0.6)

    for x, y in zip(xs_s, ys_s, strict=False):
        color = SCORE_COLORS[min(int(y * 4), 4)]
        ax2.scatter(x, y, color=color, s=90, zorder=3, alpha=0.60, edgecolors=color, linewidths=0.7)

    _labels = [
        (0.25, 0.87, "Polished", FG_COLOR, "bold", 9),
        (0.25, 0.80, "narrow probe, strong craft", MUTED_COLOR, "italic", 7),
        (0.75, 0.87, "Thorough", FG_COLOR, "bold", 9),
        (0.75, 0.80, "wide probe, strong craft", MUTED_COLOR, "italic", 7),
        (0.25, 0.17, "Sparse", "#c0392b", "bold", 9),
        (0.25, 0.10, "narrow probe, weak craft", MUTED_COLOR, "italic", 7),
        (0.75, 0.17, "Scattered", "#d4700a", "bold", 9),
        (0.75, 0.10, "wide probe, weak craft", MUTED_COLOR, "italic", 7),
    ]
    for _x, _y, _txt, _col, _style, _sz in _labels:
        _kw: dict = {"fontweight": "bold"} if _style == "bold" else {"style": "italic"}
        ax2.text(
            _x,
            _y,
            _txt,
            transform=ax2.transAxes,
            fontsize=_sz,
            color=_col,
            ha="center",
            va="center",
            **_kw,
        )

    ax2.set_xlabel("How well the tests probe — signal breadth", fontsize=9, color=MUTED_COLOR)
    ax2.set_ylabel("How well the tests are written — craft quality", fontsize=9, color=MUTED_COLOR)
    ax2.set_xlim(-0.05, 1.05)
    ax2.set_ylim(-0.05, 1.05)
    ax2.tick_params(colors=MUTED_COLOR)
    for spine in ax2.spines.values():
        spine.set_color(BORDER_COLOR)
    ax2.set_title("Test Signal vs Test Craft (per module)", fontsize=11, color=FG_COLOR, fontweight="bold")
    ax2.grid(color=GRID_COLOR, linewidth=0.4, alpha=0.6)

    p2 = output_dir / "tqs_signal_quality.png"
    fig2.savefig(p2, dpi=150, bbox_inches="tight", facecolor=BG_COLOR)
    plt.close(fig2)
    print(f"[TQS] Written {p2.relative_to(REPO_ROOT)}")

    # ---- Plot 3: Score CDF with X axis as % of max score --------------------
    all_scores = sorted(r["total_score"] for r in records)
    n = len(all_scores)
    score_range_pct = [s / 32.0 * 100 for s in range(33)]
    cdf_vals = [sum(1 for s in all_scores if s <= t) / n for t in range(33)]

    fig3, ax3 = plt.subplots(figsize=(6, 4))
    fig3.patch.set_facecolor(BG_COLOR)
    ax3.set_facecolor(BG_COLOR)

    ax3.step(score_range_pct, cdf_vals, where="post", color=ACCENT_COLOR, linewidth=2.5)
    ax3.fill_between(score_range_pct, cdf_vals, step="post", alpha=0.18, color=ACCENT_COLOR)

    tqs_val = compute_tqs(records)
    median_score = all_scores[n // 2]
    median_pct = median_score / 32.0 * 100
    ax3.axvline(
        median_pct,
        color=MUTED_COLOR,
        linewidth=0.9,
        linestyle=":",
        label=f"Median = {median_score}/32 ({median_pct:.0f}%)",
    )

    ax3.set_xlabel("Score as % of maximum (0/32 – 32/32)", fontsize=9, color=MUTED_COLOR)
    ax3.set_ylabel("Cumulative fraction of tests", fontsize=9, color=MUTED_COLOR)
    ax3.set_xlim(0, 100)
    ax3.set_ylim(0, 1.05)
    ax3.xaxis.set_major_formatter(plt.FuncFormatter(lambda v, _: f"{v:.0f}%"))
    ax3.tick_params(colors=MUTED_COLOR)
    for spine in ax3.spines.values():
        spine.set_color(BORDER_COLOR)
    ax3.grid(color=GRID_COLOR, linewidth=0.5)
    ax3.legend(fontsize=8, facecolor="white", edgecolor=BORDER_COLOR, labelcolor=FG_COLOR)
    ax3.set_title(f"Score CDF — TQS = {tqs_val:.1%}", fontsize=11, color=FG_COLOR, fontweight="bold")

    p3 = output_dir / "tqs_cdf.png"
    fig3.savefig(p3, dpi=150, bbox_inches="tight", facecolor=BG_COLOR)
    plt.close(fig3)
    print(f"[TQS] Written {p3.relative_to(REPO_ROOT)}")


def print_summary(records: list[dict[str, Any]]) -> None:
    """Print TQS summary to stdout."""
    if not records:
        print("[TQS] No analytics records found. Run 'make test-analytics' first.")
        return

    tqs = compute_tqs(records)
    print(f"\n{'=' * 50}")
    print(f"  Test Quality Score: {tqs:.1%}")
    print(f"  Tests evaluated:          {len(records)}")
    print(f"{'=' * 50}")

    # Per-dimension means
    print("\n  Dimension means:")
    for d, label in zip(DIMENSIONS, DIMENSION_LABELS, strict=True):
        mean_val = sum(r["dimensions"].get(d, 0) for r in records) / len(records)
        bar = "█" * int(mean_val) + "░" * (4 - int(mean_val))
        clean_label = label.replace("\n", " ")
        print(f"    {clean_label:<28} {mean_val:.2f}/4.00  {bar}")

    # Blocking count
    blocking = [r for r in records if any(r["dimensions"].get(d, 0) == 0 for d in DIMENSIONS)]
    if blocking:
        print(f"\n  [WARNING] {len(blocking)} test(s) have at least one dimension scored 0 (blocking at beta+)")

    print()


def main() -> None:
    """Entry point."""
    parser = argparse.ArgumentParser(description="Compute TQS and generate analytics dashboard.")
    parser.add_argument(
        "--output",
        type=Path,
        default=PLOTS_DIR / "tqs_dashboard.png",
        help="Output path for dashboard PNG",
    )
    parser.add_argument("--no-plot", action="store_true", help="Skip dashboard generation, print summary only")
    parser.add_argument(
        "--plots-dir",
        type=Path,
        default=PLOTS_DIR,
        help="Directory for individual plot PNGs (default: docs/plots/)",
    )
    args = parser.parse_args()

    records = load_all_records()
    gates = current_phase_gates()
    print_summary(records)

    if not args.no_plot and records:
        generate_dashboard(records, args.output, phase_gates=gates or None)
        generate_individual_plots(records, args.plots_dir)


if __name__ == "__main__":
    main()
