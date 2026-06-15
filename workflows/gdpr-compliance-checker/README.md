# GDPR Compliance Checker

Reviews product features, data flows, and privacy notices against GDPR obligations. Flags missing legal bases, incomplete data subject rights flows, and retention policy gaps. Outputs a prioritised remediation plan with article references.

## Inputs

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `feature_description` | string | yes | `User analytics pipeline with third-party sharing` |
| `privacy_notice_url` | string | no | `https://decide.as/privacy` |

## Outputs

- `compliance_report.pdf` — GDPR gap analysis with article references
- `remediation_plan.json` — prioritised remediation items

## Usage

```bash
claude
```

Describe the feature or data flow you want reviewed. Claude will map it against GDPR obligations and produce a gap analysis.
