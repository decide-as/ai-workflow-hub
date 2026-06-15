# Task Prioritiser

Scores and ranks backlog items using ICE and RICE frameworks, enriched with strategic alignment context. Outputs a prioritised backlog with scoring rationale and a recommended sprint plan.

## Inputs

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `backlog` | file | yes | `backlog_q3_2026.csv` |
| `strategic_goals` | string | yes | `1. Reduce manual finance work by 60%` |
| `sprint_capacity` | number | no | `80` |

## Outputs

- `prioritised_backlog.json` — ranked backlog with scores
- Sprint plan recommendation (Markdown)

## Usage

```bash
claude
```

Paste your backlog items and strategic goals. Claude will score and rank them.
