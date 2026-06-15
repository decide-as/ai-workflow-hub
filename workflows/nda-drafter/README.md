# NDA Drafter

Generates a balanced mutual NDA from counterparty details and negotiation preferences. Covers standard protections and flags non-standard requests. Outputs a clean draft for counsel review.

## Inputs

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `counterparty_name` | string | yes | `Acme Technologies AS` |
| `purpose` | string | yes | `Evaluating a potential product integration` |
| `term_years` | number | no | `3` |
| `governing_law` | string | no | `Norwegian law` |

## Outputs

- `nda_draft.md` — mutual NDA ready for counsel review

## Usage

```bash
claude
```

Provide the counterparty name, the business purpose, and any specific terms you want. Claude will draft a mutual NDA.
