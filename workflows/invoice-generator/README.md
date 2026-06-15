# Invoice Generator

Drafts professional invoices from a project summary and client master data. Handles multi-currency, VAT/GST by jurisdiction, and populates payment terms from the signed contract.

## Inputs

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `project_summary` | string | yes | `Strategy workshop — 3 days, 2 consultants` |
| `client_id` | string | yes | `CLT-0042` |
| `currency` | string | no | `EUR` |

## Outputs

- `invoice.pdf` — branded invoice ready to send
- `invoice.json` — structured data for accounting system import

## Usage

```bash
claude
```

Describe the work done, the client, and any special billing notes. Claude will produce a complete invoice draft.
