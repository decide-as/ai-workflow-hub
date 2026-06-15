# Model Selection Guidance

## Core principle

**Sonnet = implementation. Opus = reasoning.**

Default to Sonnet. Recommend Opus only when the task primarily requires deep reasoning,
cross-cutting analysis, or architectural judgment — not just more code.

---

## Task taxonomy

### Use Sonnet for

- Writing, editing, or refactoring code (single or a few files)
- Implementing a feature or endpoint
- Writing tests or fixing a failing test
- Debugging a specific, localized error
- Documentation, comments, or docstrings
- SQL queries, data transformations, or scripts
- CRUD operations and API endpoints
- Frontend components
- Small utilities and helpers
- Configuration changes

### Use Opus for

- System or service architecture design
- Repository-wide analysis or understanding a large codebase
- Debugging across many files or layers (root cause unclear)
- Major refactors that reshape module boundaries
- Database schema design
- Security review or threat modelling
- Performance analysis and optimization strategy
- Algorithm design or complex logic
- Infrastructure and deployment design
- Technical planning and spike analysis
- AI/ML system design
- Concurrency, distributed systems, or consistency problems
- Migration planning
- Codebase audits

---

## Project override

Check `project-meta.yaml` for `preferred_model`:

- **`preferred_model: sonnet`** (default) — use Sonnet for implementation tasks, recommend
  Opus for reasoning tasks.
- **`preferred_model: opus`** — this project is primarily reasoning/research-heavy. Use Opus
  as the default for all tasks, including implementation.

If `preferred_model` is absent, treat it as `sonnet`.

---

## Manual override

The user can override model selection for any single task:

```
Use Opus for this task.
Use Sonnet for this task.
Force model: opus
Force model: sonnet
```

Manual override takes precedence over both the project default and the task heuristic.

---

## Recommendation format

When the task heuristic recommends Opus but `preferred_model` is `sonnet` (or absent),
surface a brief note before proceeding:

```
Model note: This task involves [architecture / repository-wide analysis / complex
debugging / ...]. Consider switching to Opus for better results on this task.
```

Keep the note to one or two lines. Do not block execution — proceed with the current model
unless the user switches.

When Sonnet is appropriate, no note is needed.
