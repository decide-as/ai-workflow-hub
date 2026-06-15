# Mermaid Diagram Maintenance

When creating or modifying Markdown files, evaluate whether Mermaid diagrams should be created, updated, or removed.

## When to add a diagram

Add a Mermaid diagram when a Markdown file contains:

- A multi-step workflow or procedure (3+ sequential steps with conditional gates or loops)
- A decision tree with branching logic that is hard to follow as prose
- A state machine or lifecycle with named transitions
- Cross-file relationships or dependency maps that readers need to navigate

Do not add diagrams for:

- Simple checklists or bullet lists that are already clear
- Tables that already communicate the structure well
- Short procedures with no branching logic
- Content where a diagram would just restate the prose without clarifying it

## When to update a diagram

Update an existing Mermaid diagram when:

- The prose it visualizes has changed (steps added, removed, reordered, or renamed)
- The conditional logic has changed (new branches, removed gates, different fallbacks)
- The diagram no longer matches the current state of the document

After modifying a rule file that contains a Mermaid diagram, re-read the diagram and verify it still matches the prose below it. If it drifted, fix it in the same commit.

## When to remove a diagram

Remove a Mermaid diagram when:

- The prose it visualized has been deleted or simplified to the point where the diagram adds no value
- The workflow it described no longer exists
- The diagram has become misleading or contradicts the current prose

## Placement

- Embed diagrams directly in the Markdown file they describe, near the top of the relevant section
- Place the diagram before the detailed prose it summarizes, so readers get the overview first
- Use a heading like `## Workflow overview`, `### Flowchart`, or similar to introduce the diagram

## Diagram style

- Use `flowchart TD` (top-down) for sequential workflows and decision trees
- Use `flowchart LR` (left-right) for linear progressions or pipelines
- Use `subgraph` to group related nodes when the diagram has distinct phases
- Use `([text])` (stadium shape) for start/end nodes
- Use `{text}` (diamond) for decision points
- Use `[text]` (rectangle) for action steps
- Use `-->|label|` for labeled edges
- Use `-.->|label|` for annotation-only edges (scope rules, side notes)
- Keep node labels short (under 30 characters). Use line breaks `<br>` for longer labels.
- Do not add styling directives (`style`, `classDef`, `click`) — keep diagrams portable and renderer-agnostic

## Scope

This rule applies to all Markdown files in the project, including:

- `.claude/rules/*.md`
- `docs/*.md`
- `README.md`
- `ARCHITECTURE.md`
- Any other documentation files

It does not apply to code comments or docstrings.
