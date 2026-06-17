---
bump: minor
---

### Added
- Dark/light mode theming with automatic macOS system preference detection (`prefers-color-scheme`), manual Sun/Moon toggle in header, and localStorage persistence for override.
- Light theme using the lanserbart beige palette (`#f9f6f2` warm white base) via CSS custom properties.
- No-flash inline script in `index.html` applies the correct theme before React mounts.

### Changed
- Schedule status controls (cadence, last run, enable/disable, logs) moved from workflow cards into the workflow detail modal as a live Schedule section.
- Workflow cards now show a uniform footer with only the primary CTA button — schedule state no longer clutters the card grid.
- `InlineRecordButton` renamed to `TranscribeControls` with an `onTranscribed` callback and proper error state handling.
- `WorkflowCard` accepts new `clusterColor?` prop and `onOpen(id, initialPrompt?)` signature, consistent with the rest of the component tree.
