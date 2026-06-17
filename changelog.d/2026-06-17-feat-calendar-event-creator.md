---
bump: minor
---

### Added

- Calendar Event Creator workflow: describe events in text, record voice, or paste a transit/flight screenshot — Claude generates AppleScript and runs it directly in Apple Calendar.
- New `calendar` workflow action type with `CalendarModal` component for the generate-review-execute flow.
- Main-process IPC handlers for `exec-osascript`, `read-clipboard-image`, and `generate-calendar-script`.
- `src/main/calendar.ts` with AppleScript conventions: programmatic date building, Oslo timezone, emoji titles, per-calendar alarm rules, walking legs in descriptions.
