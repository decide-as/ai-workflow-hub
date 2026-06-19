---
bump: minor
---

### Changed

- Workspace section dividers (colored header bars) removed from the main content area; the layout is now a single unbroken workflow grid/list.

### Added

- Workspace badge added to each workflow card (top-right of the title row in grid view, inline with the workflow name in list view), color-tinted from the workspace's hashed color. Badge is shown only when viewing "All workflows" — hidden when a workspace is selected from the sidebar.
- Schedule indicator moved next to the workspace badge on the name line in list view.
- Action button fixed to a uniform width (`w-24`) across all list rows so Open/Run buttons align consistently.
- Always-rendered `w-5` overflow slot ensures the `+N` tag pill right-aligns with other rows even when fewer than 4 tags are present.
