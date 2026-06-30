---
bump: minor
---

### Added

- Fiken MCP server (`bin/fiken-mcp.ts`) exposing `list_purchases`, `get_purchase`, `create_purchase`, and `add_purchase_attachment` tools for Claude workflow sessions.
- Fiken integration in Travel Reimbursement and Expense Reimbursement workflows — optional step to post directly to Fiken bookkeeping with receipt attachments after generating the Excel report.
- Loan Agreement workflow now optionally posts the loan transaction to Fiken (account 1500, `cash_purchase`, `paid=false`) and opens the created entry URL on success.
- "Send transaction to Fiken" toggle in the Loan Agreement modal with "View in Fiken" link shown on success.
