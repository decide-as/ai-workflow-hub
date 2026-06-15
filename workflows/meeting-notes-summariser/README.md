# Meeting Notes Summariser

Converts raw meeting transcripts or voice-memo transcriptions into structured summaries: decisions, action items with owners and deadlines, open questions, and a 3-sentence executive summary. Supports Norwegian and English.

## Inputs

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `transcript` | string | yes | `[raw transcript text]` |
| `meeting_title` | string | no | `Q2 Strategy Review — Acme AS` |

## Outputs

- Structured summary (Markdown)
- `action_items.json` — machine-readable for task tracker import

## Usage

```bash
claude
```

Paste the transcript. Claude will produce a structured summary and action item list.
