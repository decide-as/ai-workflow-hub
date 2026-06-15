---
name: prioritize
description: Score and rank initiatives using a scoring framework — 35 dimensions across Value, Risk, Constraints, and Energy with profile-based weight tuning
user-invocable: true
---


# /prioritize — Initiative Scoring

Score initiatives across 35 dimensions grouped into 4 buckets (Value, Risk, Constraints, Energy) to produce a 0-100 priority score. Weight profiles adapt the scoring framework to different project contexts. Use this before `/prd` to decide whether an initiative is worth investing in.

---

## Trigger

This skill triggers when:

- The user invokes `/prioritize`
- The user asks to evaluate, score, or rank an initiative or feature

## Arguments

- `/prioritize <initiative description>` — score a new initiative
- `/prioritize --rank` — compare and rank all stored assessments
- `/prioritize --profile <name>` — use a specific weight profile

---

## Weight profiles

The framework supports 4 profiles that adjust dimension weights for different project contexts. Dimensions with weight 0 are skipped during scoring.

| Profile | Description | Active dims |
|---------|-------------|-------------|
| `enterprise` | Large org with governance and compliance (default) | 35 |
| `small_team` | Small team or startup with lightweight process | 35 |
| `solo_dev` | Solo developer or personal project | 29 |
| `open_source` | Open-source library with community consumers | 35 |

Profile selection is stored in `project-meta.yaml` as `scoring_profile`. If not set, defaults to `enterprise`.

---

## Workflow: scoring a new initiative

### Step 1: Determine the profile

Check `project-meta.yaml` for `scoring_profile`. If not present, ask:

> What best describes this project's context?
> 1. Enterprise / large organization (multiple teams, governance, compliance)
> 2. Small team / startup (few people, lightweight process)
> 3. Solo developer / personal project (one person, no org overhead)
> 4. Open-source library / framework (community-driven, public consumers)

Map the choice to: `enterprise`, `small_team`, `solo_dev`, `open_source`.

### Step 2: Identify the initiative

If the user provided a description, use it. Otherwise ask: "What initiative or feature would you like to evaluate?"

Derive a slug from the initiative name (lowercase, hyphens, no special characters).

### Step 3: Load the framework

Read the project's scoring framework configuration to get dimensions, weights, and scoring rubrics. Apply profile weight overrides. Only present dimensions with weight > 0 for this profile.

### Step 3b: Evaluate domain qualifier

Check if a domain qualifier exists for the project's `category`:

```python
# Import the project's scoring module for domain qualifiers
# from <project_scoring_package>.domain_qualifiers import QualifierRegistry, QualifierEvaluator

registry = QualifierRegistry()
qualifier = registry.get(metadata["category"])
```

If a qualifier exists:

1. Read `project-meta.yaml` to get the full metadata dict.
2. Call `evaluator.unanswered_questions(qualifier, metadata)` to find questions that cannot be auto-derived.
3. For unanswered questions, ask the user (present the question prompt and accept yes/no).
4. Call `evaluator.evaluate(qualifier, metadata, provided_answers=user_answers)` to get a `QualifierResult`.
5. Store the `qualifier_result.adjustments` dict — pass it to the calculator's `calculate()` method in Step 5.

If no qualifier exists for the category, skip this step entirely (no adjustments).

Display the qualifier results:

```
## Domain Fitness: <qualifier name>

| Question | Answer | Source | Confidence |
|----------|--------|--------|------------|
| Is the task repetitive? | Yes | derived (category=agent) | medium |
| Does it happen at volume? | Yes | interactive | high |
| Does a mistake cost time or money? | No | interactive | high |

**Fitness:** <label> (<score>/<total>)
**Dimension adjustments:** business_value +2, sustainable_maintainability +2, ...
```

### Step 4: Score each dimension

Score all active dimensions yourself based on your understanding of the initiative, the project context, and best practice. Do **not** ask the user to score each dimension interactively — evaluate them yourself and present the full results for review.

Walk through the 4 buckets in order: **Value → Risk → Constraints → Energy**.

For each dimension, record:

1. **Score** (0-6): your assessment based on the rubric
2. **Score meaning**: the exact rubric label for the chosen score (e.g., "Clearly supports one core strategic theme")
3. **Rationale**: 1-2 sentences explaining why you chose this score, grounded in the initiative and project context
4. **Confidence** (`high`, `medium`, or `low`): how certain you are. Use `low` when you lack context and the user should review.

Present all scores in a table per bucket:

```
## Value (1/4) — N dimensions

| # | Dimension | Score | Confidence | Score meaning | Rationale |
|---|-----------|-------|------------|---------------|-----------|
| 1 | Strategic alignment | 5 | High | Strongly aligned with multiple strategic priorities | <why> |
| 2 | Business value | 4 | Medium | Significant impact on key metrics | <why> |
```

**Inverted dimension scoring**: For inverted dimensions, check whether the rubric's 0-to-6 direction matches the inversion expectation (0=best for inverted). Some rubrics are written in natural order (0=worst, 6=best) even when the code inverts via `adjusted = 6 - raw`. Score according to the **calculation's needs**: if the situation is good for an inverted dimension with a "wrong direction" rubric, score LOW so the inversion produces a high adjusted score. Note this in the rationale when it occurs.

After presenting, tell the user they can adjust any scores before proceeding to calculation.

### Step 5: Calculate results

After all scores are collected, use the project's scoring calculator:

```python
# Import the project's scoring calculator
# from <project_scoring_package>.calculator import ScoringCalculator

calc = ScoringCalculator()
# Pass qualifier adjustments if Step 3b produced them, otherwise omit
result = calc.calculate(scores, profile="<profile>", adjustments=qualifier_adjustments)
```

If domain qualifier adjustments were applied, note in the output which dimensions were nudged and by how much. This makes the scoring transparent and auditable.

### Step 6: Display results

Present results as a summary table:

```
## Scoring Results: <initiative name>
Profile: <profile>

| Bucket | Score |
|--------|-------|
| Value | <score> |
| Risk | <score> |
| Constraints | <score> |
| Energy | <score> |
| **Total** | **<score>** |
```

Then provide a brief interpretation:

- Scores above 70: strong candidate — proceed to PRD
- Scores 50-70: moderate — worth considering, review weak buckets
- Scores 30-50: weak — significant concerns, address blockers first
- Scores below 30: poor fit — reconsider or defer

Highlight the weakest bucket and its lowest-scoring dimensions as areas of concern.

### Step 7: Improvement suggestions

After displaying results, review all dimensions that scored **≤ 2** or were marked **low confidence**. For each, read the `improvement_hint` field from the scoring framework configuration and present actionable suggestions the user can follow to improve the score.

Present as a table:

```
## How to improve this score

| Dimension | Score | Confidence | What you can provide |
|-----------|-------|------------|---------------------|
| Strategic alignment | 2 | Low | Provide your company/team strategy, roadmap, or quarterly OKRs so alignment can be evaluated against concrete objectives |
| Capacity match | 3 | Low | Specify team size, available skills, current workload, and who would execute this initiative |
```

**Rules**:
- Include dimensions scoring ≤ 2 with `low` or `medium` confidence (likely a context gap, not a real weakness).
- Include dimensions with `low` confidence regardless of score (these may improve with better context).
- **Always skip `high` confidence dimensions** — the scorer had enough context, so the score reflects reality rather than missing information. Showing "provide X" when X was already provided is noise.
- Skip dimensions scoring ≥ 3 with `medium` confidence — they don't need action.
- Sort by score ascending (worst first), then by confidence (low first).
- If no dimensions qualify, skip this section entirely.

After the table, tell the user: "Provide any of the above and I can re-score those dimensions for a more accurate assessment."

### Step 8: Store the assessment

Derive the date by running `date +%Y-%m-%d`.

Build the `dimension_details` dict with per-dimension metadata:

```python
dimension_details = {
    "strategic_alignment": {
        "score_meaning": "Strongly aligned with multiple strategic priorities",
        "rationale": "The project's core mission directly benefits from this...",
        "confidence": "high",
    },
    # ... for every scored dimension
}
```

Save the assessment to `docs/prioritization/<date>-<slug>.yaml`:

```python
# Import the project's scoring calculator for persistence
# from <project_scoring_package>.calculator import save_assessment, update_index

save_assessment(
    path=Path(f"docs/prioritization/{date}-{slug}.yaml"),
    initiative=initiative_name,
    slug=slug,
    assessed_by=assessed_by,
    assessed_on=date,
    scores=scores,
    result=result,
    profile=profile,
    dimension_details=dimension_details,
)
update_index(Path("docs/prioritization"))
```

The saved YAML includes per-dimension entries with `score`, `score_meaning`, `rationale`, and `confidence` fields. This makes assessments self-documenting and auditable.

Confirm storage to the user and offer: "Run `/prioritize --rank` to compare against other assessed initiatives."

---

## Workflow: ranking assessments

When the user runs `/prioritize --rank`:

1. Read all `.yaml` files in `docs/prioritization/` (excluding the index)
2. Sort by total score descending
3. Display a ranked table:

```
## Initiative Rankings

| Rank | Initiative | Profile | Value | Risk | Constraints | Energy | Total |
|------|-----------|---------|-------|------|-------------|--------|-------|
| 1 | Feature A | solo_dev | 72 | 61 | 85 | 58 | 68 |
| 2 | Feature B | enterprise | 44 | 57 | 52 | 65 | 53 |
```

**Note**: Scores from different profiles are not directly comparable because weight distributions differ. Flag this when displaying mixed-profile rankings.

If no assessments exist, tell the user: "No assessments found. Run `/prioritize <initiative>` to score one."

---

## Integration with /prd

The `/prd` and `/prioritize` skills integrate bidirectionally:

### When `/prd` triggers (automatic)

Scoring runs automatically as Step 3b of the PRD workflow. The PRD's structured content (Problem, Goals, Scope, Risks, Affected Modules) provides the scoring context — no need to re-describe the initiative. Results appear in the PRD's "Prioritization" section and auto-derive the `priority` field. The assessment YAML is saved alongside the PRD.

### When `/prioritize` runs standalone

After scoring, if the total is above 50, suggest: "Consider running `/prd` to define the problem and scope before implementation." The PRD can reference the assessment in its `related_docs` field.

### Shared storage

Both workflows save assessments to `docs/prioritization/<date>-<slug>.yaml` using the same `save_assessment()` and `update_index()` functions. Assessments from either path appear in `/prioritize --rank` rankings.

---

## Key mathematical properties

- **35 dimensions** across 4 buckets, with profile-based weight overrides
- **Constraints bucket uses multiplicative aggregation** — any dimension scoring 0 zeros the entire bucket and the total score. This is intentional: a fatal constraint kills the initiative.
- **Other buckets use weighted averages** — dimensions contribute proportionally to their weight.
- **Total is a weighted geometric mean** of bucket scores — each bucket's influence is proportional to its weight.
- **Inversion** flips "high is bad" dimensions so that a higher adjusted score always means better.
- **Zero-weight dimensions** are skipped entirely — not scored, not included in calculations.

See `docs/prioritization/METHODOLOGY.md` for the complete mathematical specification.
