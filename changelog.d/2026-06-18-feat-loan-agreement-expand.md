---
bump: minor
---

### Added

- New lender "Valentina Valkova" and borrower "Vshape Nails AS" registered in loan stakeholders
- Conditional borrower filtering per lender: each lender now has an `allowedBorrowers` list so only relevant counterparties appear in the dropdown
- New "Accrued Loan Interest" workstream (`loan-interest` action) with a full transaction management modal — add, edit, delete loan disbursements and repayments per lender/borrower pair
- Skjermingsrente lookup from skatteetaten.no for automatic rate retrieval per bimonthly period

### Fixed

- Interest calculation now locks the skjermingsrente at the tranche creation date; rate changes after a loan is made no longer retroactively affect outstanding tranches (FIFO repayment order preserved)
