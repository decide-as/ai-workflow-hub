---
name: practices
description: World-class coding practices — context-aware subset based on project metadata
user-invocable: true
---

# Coding Practices

This skill provides the project's applicable coding practices. Practices are organized into groups (A–F) and included based on the project's `project-meta.yaml` metadata. Only practices relevant to this project are present below.

## When to invoke

- Starting a new feature or module to review applicable standards
- During code review to check compliance with project practices
- When onboarding to understand what quality standards apply

## How practices are selected

Each practice fragment has a gate function evaluated against `project-meta.yaml`. The gate system uses these metadata fields: `language`, `has_tests`, `quality_gate`, `world_class`, `category`, `has_ui`, `has_database`, `branching_complexity`, and `practice_overrides`.

| Group | Scope | Primary gate |
|-------|-------|-------------|
| **A** — Foundations | Error handling, dependencies, config | `language` is python or node |
| **B** — Testing | Strategy, coverage tiers, mutation | `has_tests` and `quality_gate` |
| **C** — Quality | Code review, design docs, diagrams | `world_class` is true |
| **D** — Runtime & Ops | Logging, structured logging, performance, caching, metrics | `language` or service `category` |
| **E** — Interfaces | API design, database, accessibility, i18n | `has_database`, `has_ui` |
| **F** — Operations | Incident response, post-mortems, runbooks | service `category` + `phase` >= beta |

Override any gate via `practice_overrides` in `project-meta.yaml` (e.g., `{a1-error-handling: true}` to force-include, `{c1-code-review: false}` to force-exclude).

The practices below are the authoritative reference for this project. They complement (not replace) the always-loaded rules in `.claude/rules/`.
