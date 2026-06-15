# Client Email Drafter

Turns bullet-point notes into polished, professional client-facing emails. Adapts tone to the client's communication style and flags anything that needs legal review before sending.

## Inputs

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `bullet_notes` | string | yes | `- Delay on deliverable 3 by 1 week` |
| `client_name` | string | yes | `Ola Nordmann, Acme AS` |
| `tone` | string | no | `Professional but warm` |

## Outputs

- Email subject line + body, ready to paste into your mail client

## Usage

```bash
claude
```

Paste your bullet points and the client's name. Claude will draft a complete email.
