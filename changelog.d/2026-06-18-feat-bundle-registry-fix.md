---
bump: patch
---

### Fixed

- Bundle registry into production app build so workflow cards load correctly in packaged builds.
- Compact `BookkeepingControls` idle state to a single-row drop target, eliminating the card height inconsistency in the grid.
- Ensure all workflow cards share a uniform minimum height via CSS `min-height` on the description element.
