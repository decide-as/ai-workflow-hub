# Proposal Writer

Structures commercial proposals from scope notes, pricing tables, and company context into polished client-facing documents. Applies your brand voice and produces a PDF-ready DOCX.

## Inputs

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `scope_notes` | string | yes | `AI workflow automation — 3 month engagement` |
| `pricing_table` | string | yes | `Phase 1: NOK 120 000 / Phase 2: NOK 280 000` |
| `client_background` | string | no | `Mid-sized Norwegian industrial company, SAP ERP` |

## Outputs

- `proposal.md` — fully structured commercial proposal
- Standalone executive summary section

## Usage

```bash
claude
```

Describe the scope and pricing. Claude will write the full proposal with all standard sections.
