#!/usr/bin/env python3
"""Cross-language scaffolded test comparison report.

Reads test-manifest.yaml and produces a markdown comparison matrix showing
test coverage across all language templates. Distinguishes inherited, direct,
and missing tests per template.

Usage:
    python test-manifest-report.py [--output PATH]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

CONTENT_DIR = Path(__file__).resolve().parents[2] / "src" / "code_practices" / "content"
MANIFEST_PATH = CONTENT_DIR / "templates" / "test-manifest.yaml"

# Test categories inferred from description keywords and filenames.
CATEGORY_RULES: list[tuple[str, list[str]]] = [
    ("structural", ["structure", "required files", "metadata", "version sync", "readme health"]),
    ("quality", ["docstring", "no print", "no secret", "code quality", "todo"]),
    ("smoke", ["smoke", "import"]),
    ("framework", ["endpoint", "health", "api", "app", "component", "render"]),
]


def classify_test(description: str, path: str) -> str:
    """Classify a test file into a category based on its description and path."""
    desc_lower = description.lower()
    path_lower = path.lower()
    for category, keywords in CATEGORY_RULES:
        if any(kw in desc_lower or kw in path_lower for kw in keywords):
            return category
    return "other"


def load_manifest() -> dict:
    """Load and return the test manifest."""
    with open(MANIFEST_PATH) as f:
        return yaml.safe_load(f)


def resolve_tests(templates: dict) -> dict[str, dict[str, list[dict]]]:
    """Resolve tests per template, including inherited tests.

    Returns: {template_name: {category: [test_entries]}}
    Each test_entry has 'path', 'description', 'source' ('direct' or 'inherited').
    """
    resolved: dict[str, dict[str, list[dict]]] = {}

    for name, info in templates.items():
        tests_by_cat: dict[str, list[dict]] = {}

        # Inherited tests from base template
        parent = info.get("inherits")
        if parent and parent in templates:
            parent_info = templates[parent]
            for test in parent_info.get("tests", []):
                cat = classify_test(test["description"], test["path"])
                tests_by_cat.setdefault(cat, []).append({**test, "source": "inherited"})

        # Direct tests
        for test in info.get("tests", []):
            cat = classify_test(test["description"], test["path"])
            tests_by_cat.setdefault(cat, []).append({**test, "source": "direct"})

        resolved[name] = tests_by_cat

    return resolved


def render_report(templates: dict, resolved: dict[str, dict[str, list[dict]]]) -> str:
    """Render the full markdown report."""
    categories = ["structural", "quality", "smoke", "framework", "other"]
    lines: list[str] = []

    lines.append("# Cross-Language Scaffolded Test Report\n")

    # --- Language summary ---
    lang_stats: dict[str, dict] = {}
    for name, info in templates.items():
        if name.startswith("_"):
            continue
        lang = info.get("language", "none")
        stats = lang_stats.setdefault(lang, {"templates": 0, "with_tests": 0, "test_count": 0})
        stats["templates"] += 1
        all_tests = resolved.get(name, {})
        total = sum(len(v) for v in all_tests.values())
        stats["test_count"] += total
        if total > 0:
            stats["with_tests"] += 1

    lines.append("## Language Summary\n")
    lines.append("| Language | Templates | With Tests | Test Files | Coverage |")
    lines.append("|----------|-----------|-----------|------------|----------|")
    for lang in sorted(lang_stats, key=lambda k: lang_stats[k]["templates"], reverse=True):
        s = lang_stats[lang]
        pct = (s["with_tests"] / s["templates"] * 100) if s["templates"] > 0 else 0
        lines.append(f"| {lang} | {s['templates']} | {s['with_tests']} | {s['test_count']} | {pct:.0f}% |")
    total_templates = sum(s["templates"] for s in lang_stats.values())
    total_with = sum(s["with_tests"] for s in lang_stats.values())
    total_tests = sum(s["test_count"] for s in lang_stats.values())
    total_pct = (total_with / total_templates * 100) if total_templates > 0 else 0
    lines.append(f"| **Total** | **{total_templates}** | **{total_with}** | **{total_tests}** | **{total_pct:.0f}%** |")

    # --- Comparison matrix ---
    lines.append("\n## Comparison Matrix\n")
    lines.append("Markers: `✓` direct, `↑` inherited, `—` missing\n")
    header = "| Template | Language | " + " | ".join(c.title() for c in categories) + " |"
    sep = "|----------|----------|" + "|".join("----------" for _ in categories) + "|"
    lines.append(header)
    lines.append(sep)

    # Base templates first, then concrete grouped by language
    bases = sorted(n for n in templates if n.startswith("_"))
    concrete = sorted(
        (n for n in templates if not n.startswith("_")),
        key=lambda n: (templates[n].get("language", "zzz"), n),
    )

    for name in bases + concrete:
        info = templates[name]
        lang = info.get("language", "none")
        tests = resolved.get(name, {})
        cells: list[str] = []
        for cat in categories:
            cat_tests = tests.get(cat, [])
            if not cat_tests:
                cells.append("—")
            elif all(t["source"] == "inherited" for t in cat_tests):
                cells.append(f"↑ ({len(cat_tests)})")
            elif all(t["source"] == "direct" for t in cat_tests):
                cells.append(f"✓ ({len(cat_tests)})")
            else:
                inherited = sum(1 for t in cat_tests if t["source"] == "inherited")
                direct = sum(1 for t in cat_tests if t["source"] == "direct")
                cells.append(f"✓{direct}+↑{inherited}")

        row = f"| {name} | {lang} | " + " | ".join(cells) + " |"
        lines.append(row)

    # --- Top gaps ---
    lines.append("\n## Top Gaps\n")
    lines.append("Templates missing test categories that base templates provide:\n")

    # Only report gaps for templates with a real language.
    # "framework" is only a gap if the template is a framework archetype
    # (has "api", "flask", "express", "django", "next", "svelte" in name).
    framework_names = {"fastapi", "flask", "django", "express", "nextjs", "sveltekit"}
    gaps: list[tuple[str, str, str]] = []
    for name in concrete:
        info = templates[name]
        lang = info.get("language", "none")
        if lang == "none":
            continue  # docs/data-repo — no tests expected
        tests = resolved.get(name, {})
        for cat in categories:
            if cat == "framework" and not any(fw in name for fw in framework_names):
                continue  # framework tests only expected for framework templates
            if cat not in tests:
                gaps.append((name, lang, cat))

    if gaps:
        lines.append("| Template | Language | Missing Category |")
        lines.append("|----------|----------|-----------------|")
        for tname, lang, cat in gaps:
            lines.append(f"| {tname} | {lang} | {cat} |")
    else:
        lines.append("No gaps found — all templates cover all categories.")

    lines.append("")
    return "\n".join(lines)


def main() -> None:
    """Entry point."""
    parser = argparse.ArgumentParser(description="Cross-language scaffolded test report")
    parser.add_argument("--output", type=Path, help="Write report to file instead of stdout")
    args = parser.parse_args()

    if not MANIFEST_PATH.exists():
        print(f"ERROR: Manifest not found at {MANIFEST_PATH}", file=sys.stderr)
        sys.exit(1)

    data = load_manifest()
    templates = data.get("templates", {})
    resolved = resolve_tests(templates)
    report = render_report(templates, resolved)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(report)
        print(f"Report written to {args.output}")
    else:
        print(report)


if __name__ == "__main__":
    main()
