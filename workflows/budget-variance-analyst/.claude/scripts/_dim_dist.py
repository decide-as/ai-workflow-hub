#!/usr/bin/env python3
"""Print per-dimension score distribution (0-4) as counts and cumulative percentages."""

import json
from pathlib import Path

ANALYTICS_DIR = Path(__file__).parent.parent / "tests" / ".analytics"
DIMS = [
    "structure_organization",
    "contract_intent",
    "isolation_determinism",
    "scenario_breadth",
    "execution_speed",
    "maintainability",
    "assertion_precision",
    "edge_coverage",
]
SHORT = ["struct", "contract", "isolation", "breadth", "speed", "maint", "precision", "edge"]

_V1_TO_V2 = {
    "coverage_signal": "scenario_breadth",
    "performance": "execution_speed",
    "maintenance": "maintainability",
}

counts = {d: [0] * 5 for d in DIMS}
total = 0
for f in ANALYTICS_DIR.rglob("*.json"):
    for rec in json.loads(f.read_text()).values():
        total += 1
        raw_dims = rec.get("dimensions", {})
        # Remap v1 keys to v2 names for backward compatibility with old sidecar files.
        dims = {_V1_TO_V2.get(k, k): v for k, v in raw_dims.items()}
        for d in DIMS:
            s = min(int(dims.get(d, 0)), 4)
            counts[d][s] += 1

print(f"n={total}")
print(
    f"{'dim':<12}  {'0':>5}  {'1':>5}  {'2':>5}  {'3':>5}  {'4':>5}  |  {'>=1':>6}  {'>=2':>6}  {'>=3':>6}  {'>=4':>6}"
)
print("-" * 80)
for d, s in zip(DIMS, SHORT, strict=False):
    c = counts[d]
    g1 = sum(c[1:]) / total * 100
    g2 = sum(c[2:]) / total * 100
    g3 = sum(c[3:]) / total * 100
    g4 = c[4] / total * 100
    print(
        f"{s:<12}  {c[0]:>5}  {c[1]:>5}  {c[2]:>5}  {c[3]:>5}  {c[4]:>5}  |  {g1:>5.1f}%  {g2:>5.1f}%  {g3:>5.1f}%  {g4:>5.1f}%"
    )
