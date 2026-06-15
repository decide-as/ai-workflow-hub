# Team Briefing Generator

Produces concise weekly team briefings from Slack digests, completed tasks, and upcoming deadlines. Highlights wins, flags risks, and lists priorities — ready to post in under 2 minutes.

## Inputs

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `slack_digest` | string | yes | `[Slack thread paste]` |
| `completed_tasks` | string | no | `- Shipped invoice generator v2` |

## Outputs

- Weekly team briefing (Markdown), ready to post to Slack or email

## Usage

```bash
claude
```

Paste your Slack digest and completed tasks. Claude will write a clean team briefing.
