---
bump: minor
---

### Added

- "Other…" option in Loan Agreement lender and borrower dropdowns — selecting it reveals a name field (lender) or name + bank account fields (borrower), allowing ad-hoc parties not in the registry.
- Bank account formatting helper that auto-formats 11-digit Norwegian account numbers as `xxxx.xx.xxxxx` in dropdown labels and PDF generation.

### Changed

- Loan Agreement modal now filters available borrowers based on the selected lender's `allowedBorrowers` list, with ChevronDown indicator and updated layout matching main branch improvements.
- Six native modals (LoanModal, RunModal, LogModal, CalendarModal, TranscribeModal, ReadingListModal) rethemed from hardcoded dark zinc Tailwind classes to the app's CSS variable design system, enabling correct rendering in both dark and light themes.

### Removed

- Valentina Valkova and Vshape Nails AS removed from the loan agreement stakeholder registry.
