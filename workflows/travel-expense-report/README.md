# Travel Expense Report

Processes travel receipts (images or PDFs), extracts line items via OCR, maps them to your chart of accounts, and generates a formatted expense report ready for finance approval — including a policy-compliance check.

## Inputs

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `receipts` | file | yes | `hotel_oslo_june.pdf` |
| `trip_purpose` | string | yes | `Client workshop — Oslo, June 2026` |
| `cost_centre` | string | no | `CC-4412` |

## Outputs

- `expense_report.pdf` — formatted report with itemised table and totals
- `flagged_items.json` — line items that breached policy thresholds

## Usage

```bash
claude
```

Then describe your receipts and trip purpose. Claude will extract, categorise, and format the report.



```bash
cp -r workflows/travel-expense-report /path/to/new/repo
cd /path/to/new/repo
git init && git add . && git commit -m "Initial commit"
```
