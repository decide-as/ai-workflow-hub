# Contract Reviewer

Analyses vendor and client contracts for red flags, unfavourable clauses, and gaps against your standard legal template. Produces a risk summary with severity ratings, plain-English explanations, and suggested redlines.

## Inputs

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `contract_file` | file | yes | `vendor_agreement_acme.pdf` |
| `contract_type` | string | yes | `SaaS subscription` |
| `counterparty_jurisdiction` | string | no | `England & Wales` |

## Outputs

- `risk_summary.pdf` — prioritised risk report with redlines
- `risk_data.json` — structured risk items for legal tracker

## Usage

```bash
claude
```

Paste the contract text or attach the file. Specify the contract type so Claude applies the right review lens.
