# Opinionation Principle

Prefer opinionated defaults over flexible options. Opinionated on process, flexible on problem-solving.

## Add an opinion when

- The same decision recurs and has a clear best answer
- Inconsistency between sessions has caused drift or bugs
- The decision is mechanical (formatting, naming, structure, workflow)

## Stay flexible when

- The decision requires context-specific judgment (architecture, algorithms, API design)
- Adding the rule would conflict with an existing rule or cost more tokens than it saves

## Before adding a rule

1. Check no existing rule covers it
2. Verify it won't conflict with another rule
3. Confirm it applies broadly, not to a one-off

See `docs/designs/design-2026-03-19-opinionation.md` for theory and evidence.
