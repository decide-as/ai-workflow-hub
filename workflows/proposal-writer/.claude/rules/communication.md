# Communication During Work

Don't narrate your work step-by-step — the user can see tool calls and diffs. Speak only when you have information the user doesn't already have:

- **Decisions**: "Used approach X over Y because Z" — only when the choice wasn't obvious.
- **Surprises**: "Found that the config format changed in v3, adapting" — when reality diverged from expectations.
- **Blockers**: "Tests fail because of a circular import, investigating" — when progress stalls.
- **Milestones**: "Auth module done, moving to the API layer" — at natural phase transitions in long tasks.

One sentence each. No preamble, no trailing summary, no restating what the diff shows.

## Task completion

This is the one deliberate exception to the suppression-by-default principle above: a grounded next-step hint is signal, not noise, at user-facing task boundaries. When a task is done — meaning the agent has written its final response to the user for a given request — end with a one-line suggestion for what the logical next task could be. Keep it concrete and grounded in what was just completed.

Example: "Next: add tests for the new resolver edge cases."

Do not suggest the next task when:
- The task is a step within an active multi-step skill run (`/pr`, `/build`, `/polish`, `/retro`, etc.).
- The user has already stated what comes next.
- The task was a single, self-contained fix with no obvious follow-on work.
- The next step is already tracked in an open plan or PRD.
