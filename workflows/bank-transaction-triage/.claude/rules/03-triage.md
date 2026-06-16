# 03 — Triage

Work **only on the `seen: false` lines** from `data/<batch>/checked.json` (`02`).
Report the already-seen count to the user, then triage the new lines.

## Propose, don't decide

For each new line, propose a disposition **with a one-line reason**, then let the
user confirm or override. Never finalize an ambiguous line yourself.

Heuristics for the proposal (the user has final say):

- **Personal account + business-looking merchant** → `reimburse-expense`
  (or `reimburse-travel` if it's a trip cost — see below).
- **Company account** → `register-direct` (already paid by the firm).
- **Salary, internal transfers between the user's own accounts, ATM, obvious
  personal spending** → `skip` with the reason.
- **Can't tell** → `maybe` — never force a guess into `register-*`.

### reimburse-expense vs reimburse-travel

`reimburse-travel` is for costs tied to a **specific trip** away from the normal
workplace — flights, hotels, transport in another city, trip meals. Everyday
business spending (office supplies, local lunches, subscriptions) is
`reimburse-expense`. When a line looks trip-related, ask **which trip** it belongs
to so routing (`04`) can group it.

## Presentation

Group the new lines by account, then date, and present them compactly — date,
amount, description, proposed disposition, reason. Let the user accept all, accept
per-group, or override individual lines. Capture any correction as the `reason`.

## Output

Write the dispositioned **new** lines to `data/<batch>/dispositioned.json`. Each
record keeps its `fp` (from `checked.json`) and adds:

```json
{ "fp": "…", "account": "…", "date": "…", "amount": -880.0, "currency": "NOK",
  "description": "Flytoget AS", "balance": 3687.89,
  "disposition": "reimburse-travel", "reason": "Oslo–Bergen client trip",
  "trip": "bergen-may-2026", "batch": "q2-2026", "source_file": "dnb-mai.pdf" }
```

(`trip` is present only for `reimburse-travel`.) Then append to the master ledger
(`02`). `maybe` lines are logged too — they stay visible for a later pass and are
never routed until re-triaged into a real disposition.
