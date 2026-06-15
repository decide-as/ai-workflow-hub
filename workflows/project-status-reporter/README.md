# Project Status Reporter

Generates weekly project health summaries from ticket data, time logs, and milestone trackers. Produces RAG status reports for internal teams and sanitised client-facing versions.

## Inputs

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `ticket_export` | file | yes | `jira_sprint_42.csv` |
| `project_name` | string | yes | `Acme Finance Automation — Phase 2` |
| `include_client_version` | boolean | no | `true` |

## Outputs

- `status_report.pdf` — internal RAG status report
- `client_report.pdf` — sanitised client-facing version (if requested)

## Usage

```bash
claude
```

Paste your ticket export or sprint data. Claude will produce a formatted status report.
