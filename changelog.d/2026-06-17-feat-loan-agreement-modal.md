---
bump: minor
---

### Added
- Loan Agreement Generator: structured form modal that collects lender, borrower, amount, date, and location, fetches the current skjermingsrente (shielding interest rate) from skatteetaten.no for the correct bimonthly period, generates a Norwegian-language PDF via Electron's printToPDF, saves it to `workflow-hub-data/loan-agreement/data/`, and reveals it in Finder.
- Separate lender and borrower party lists: all three parties (Christian Braathen, Decide AS, Bæredyktig AS) are available as lenders; only companies (Decide AS, Bæredyktig AS) are available as borrowers.
- Same-party validation in the loan modal: Generate button is disabled with a red warning when the same party is selected as both lender and borrower.
