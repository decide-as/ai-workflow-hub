# Budget Variance Analyst

Ingests actuals from an ERP export and compares them against the approved budget per cost centre. Generates management-ready variance commentary with root-cause hypotheses and recommended actions for the monthly board pack.

## Inputs

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `actuals_file` | file | yes | `actuals_may_2026.csv` |
| `budget_file` | file | yes | `budget_fy2026.xlsx` |
| `materiality_threshold_pct` | number | no | `5` |

## Outputs

- `variance_report.pdf` — board-ready commentary with tables
- `variance_data.json` — structured variance by cost centre

## Usage

```bash
claude
```

Paste or attach your actuals and budget files. Claude will compare, explain variances above threshold, and draft commentary.
