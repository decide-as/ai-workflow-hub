# Design Doc Maintenance

## What a design doc is and isn't

A design doc is a **decision record**: it captures what was decided, what alternatives were considered, and why the chosen approach was preferred. It is not:

- A tutorial (the code is the implementation, not the doc)
- A specification (specs are about what to build; design docs are about why it's built this way)
- A wiki page (wikis track current state; design docs track the reasoning that produced the current state)

The test: if you deleted the design doc, would a senior engineer looking at the code for the first time understand *why* the architecture is the way it is? If yes, the doc is probably redundant. If no, it's earning its keep.

## The Alternatives Considered section is the most valuable part

Future maintainers don't ask "how does this work?" — they ask "why wasn't this done differently?" When someone proposes changing the architecture six months from now, the Alternatives section is what prevents them from re-litigating decisions that were already made, or from making the same mistakes the original team evaluated and rejected.

Write it as if you're preemptively answering the objections of a skeptical senior engineer who just joined the team:

- What is the obvious alternative?
- Why wasn't it chosen? (Not "it was worse" — *how* was it worse, in concrete terms?)
- What would have to be true for the alternative to become the better choice?

If you can't fill out the Alternatives section, you probably don't understand your own decision well enough yet.

## Non-goals prevent scope creep

Non-goals are as important as goals. Explicitly stating what the system will *not* do serves two functions:

1. **Sets expectations** for users and future contributors who might assume the capability exists
2. **Prevents feature creep** by making out-of-scope additions visible as scope changes, not natural extensions

Write non-goals as concrete capability statements, not abstract principles. "This system is not intended to handle multi-tenant isolation" is useful. "This system is not intended to be over-engineered" is not.

## Writing for the reader six months from now

The primary reader of a design doc is not your current team — it's the engineer who joins after the system ships and needs to understand why it's the way it is before making changes. Write for them:

- Explain the constraints that existed at the time (engineering capacity, existing infrastructure, timeline pressure). These constraints may no longer exist, but the decision was made under them.
- Explain the problem, not just the solution. Future readers need to know whether the problem has changed before they can evaluate whether the solution still fits.
- Date every significant revision. The design that made sense in Q1 may not make sense in Q3, and readers need to know when a decision was made relative to when the context changed.

## The "living document" trap

A document that changes with every PR is not a design doc — it's a wiki page. When you find yourself updating a design doc to reflect implementation details (function signatures, config keys, error messages), stop. That information belongs in the code, in docstrings, or in an API reference.

Update a design doc only when the *architectural* decision it records has changed: the control flow, the ownership boundary, the failure handling strategy, the choice between two competing approaches. If the change is "we renamed the module" or "we added a configuration option," that's not an architectural change.

## When to supersede vs when to update

The bright line: **supersede when a new reader would be confused by the history**.

Update in place when:
- A component was renamed but serves the same architectural role
- A step was added to or removed from a workflow that otherwise has the same structure
- Constraints changed but the decision remains the same

Create a new doc (marking the old as superseded) when:
- The core architectural approach changed (e.g., sync to async, monolith to service boundary)
- The problem statement changed significantly
- A reader who followed the old doc would make incorrect implementation decisions

Mark superseded docs with `status: superseded` and link to the replacement. Do not delete them — the historical reasoning is still valuable for understanding how the system got from there to here.

## Staleness detection

A design doc that contradicts the code is worse than no design doc — it actively misleads. Signs of staleness:

- Component names in the doc don't match filenames or class names in the code
- The data flow diagram shows a step that no longer exists (or is missing a step that does)
- The Alternatives section describes a trade-off that no longer applies

When you find staleness, fix it immediately in the same PR that introduced the drift. Staleness that's noticed and deferred almost always compounds.
