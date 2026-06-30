---
id: prd-2026-06-27-cold-outreach-system
title: Cold Outreach System
owner: Christian Braathen
created: 2026-06-27
updated: 2026-06-27
status: draft
priority: P1
related_docs:
  - design-2026-06-27-cold-outreach-system.md
---

# Cold Outreach System

## Problem

There is no structured way to run cold outreach campaigns from Workflow Hub. Leads, sent emails, replies, and follow-up notes live in disconnected places (spreadsheets, email drafts, memory), making it impossible to track who is in which messaging treatment group or whether a given contact has responded.

## Context

Workflow Hub already manages finance, content, and research workflows via registry cards. The app can open Claude sessions, run scheduled scripts, and interact with local SQLite databases (see Reading List workflow). The `workflow-hub-data` repository is the canonical store for all workflow runtime data. A cold outreach system fits naturally as a new cluster alongside the existing ones.

## Goals

- Build and maintain a list of cold outreach leads with treatment group assignments
- Draft and send outreach emails from inside Workflow Hub
- Log all follow-up interactions with contacts in a single CRM view
- Automatically detect and record inbound email replies

## Non-Goals

- Multi-user / team CRM (this is a personal tool)
- Mass email blasting / ESP integration (Mailchimp, SendGrid)
- Lead enrichment from paid data providers
- Calendar scheduling or meeting booking

## Scope

### In Scope

- **Lead Builder** workflow: Claude session that researches and adds leads to the DB, assigning each to a treatment group
- **Email Sender** workflow: Claude session that drafts outreach emails from leads and sends them via macOS Mail
- **CRM / Follow-up Log** workflow: Claude session that shows interaction history and logs new follow-up notes
- **Email Inbox Checker** workflow (scheduled): script that polls IMAP inbox, matches replies to known leads, and logs them to the DB
- Shared SQLite database at `workflow-hub-data/cold-outreach/data/outreach.db`
- New `outreach` cluster in `registry/workflows.yaml`
- Data folder structure and README in `workflow-hub-data/cold-outreach/`

### Out of Scope

- UI changes to the Workflow Hub Electron app
- OAuth-based email authentication (IMAP with app password is sufficient)
- Analytics dashboard for treatment group performance (logging is sufficient for now)
- Unsubscribe / opt-out management

## Success Criteria

1. All four workflow cards appear under an "Outreach" cluster in the app
2. A lead added via Lead Builder appears in the SQLite DB with `treatment_group`, `email`, `name`, `company`, and `status` fields populated
3. An email drafted and sent via Email Sender is recorded in the `emails_sent` table with `lead_id`, `subject`, `sent_at`
4. A follow-up note logged via CRM appears in the `interactions` table with `lead_id`, `type`, `notes`, `created_at`
5. The scheduled Email Inbox Checker detects a reply from a known lead email address and inserts a row in `interactions` with `type = reply`
6. Treatment group distribution can be queried directly from the DB (`SELECT treatment_group, COUNT(*) FROM leads GROUP BY treatment_group`)

## Users and Stakeholders

- **Christian** — the only user; running personal cold outreach campaigns

## Requirements

### Functional

- System must store leads in a SQLite database with at minimum: `id`, `name`, `email`, `company`, `source`, `treatment_group`, `status`, `created_at`, `notes`
- System must record each sent email: `id`, `lead_id`, `subject`, `body_preview`, `sent_at`, `template_name`
- System must record all follow-up interactions: `id`, `lead_id`, `type` (call / note / reply / meeting), `notes`, `created_at`
- Lead Builder must accept a treatment group as part of its session context
- Email Sender must read un-contacted leads from the DB and allow Claude to draft a message matching the lead's treatment group template
- CRM must surface all interactions for a given contact in chronological order
- Email Inbox Checker must use IMAP to poll a configured inbox, match `From:` against known lead email addresses, and insert reply interactions
- Email Inbox Checker must run as a scheduled workflow (`trigger_type: scheduled`) using a wrapper script similar to `scripts/finn-job-tracker-wrapper.sh`
- Credentials (IMAP host, username, app password) must be read from `.env`, never hardcoded

### Non-Functional

- SQLite database must be a single file for easy backup and inspection
- IMAP polling script must be idempotent (replaying it must not create duplicate reply rows)
- Sensitive credentials must not appear in `registry/workflows.yaml` or any committed file

## Affected Modules

| Module | Impact |
|---|---|
| `registry/workflows.yaml` | 4 new workflow entries + 1 new cluster |
| `workflow-hub-data/cold-outreach/` | New data folder with DB, schema, and README |
| `scripts/outreach-email-checker.py` | New scheduled IMAP polling script |
| `scripts/outreach-email-checker-wrapper.sh` | New wrapper with Pushover error notification |

## Dependencies

- macOS Mail (for email sending from Claude sessions)
- IMAP-accessible email inbox with an app password
- Python 3 with `imaplib` (stdlib) for the inbox checker
- SQLite3 (stdlib) — no new dependencies

## Risks

- IMAP reply matching relies on exact email address match — fails if a lead replies from a different address
- macOS Mail sending is done by Claude in the session, not programmatically — harder to verify `sent_at` timestamps automatically
- `.env` file must exist and contain IMAP credentials before the scheduled workflow runs

## Assumptions

- IMAP is available for the configured inbox (Gmail with App Password, Fastmail, or similar)
- Treatment groups are simple text labels (e.g., `value-first`, `case-study`, `demo-ask`) — no complex branching logic
- "Sending" an email means Claude drafts it and the user reviews/sends from macOS Mail (not fully automated SMTP)
- The scheduler for Email Inbox Checker is macOS `launchd` / cron, configured outside the app (same pattern as the Finn Job Tracker)

## Open Questions

- **Q:** Should treatment group *templates* be stored in the DB or in a markdown file in the data folder?
  **Recommendation:** Markdown file (`workflow-hub-data/cold-outreach/templates/<group>.md`) — easier to edit, diff, and read in Claude sessions without writing a DB query. The DB stores only the `treatment_group` label on the lead.

- **Q:** Should Email Inbox Checker write reply interactions to *all* matched leads, or only leads with `status = contacted`?
  **Recommendation:** Only `status = contacted` — avoids false positives from prior unrelated email threads with someone who later becomes a lead.
