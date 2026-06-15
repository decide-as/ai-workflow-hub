# Mermaid Diagrams

## The real purpose of diagrams

Diagrams expose misunderstandings that prose hides. If two engineers read the same prose description of a system and draw different diagrams, the prose is ambiguous — and you've just found a specification bug before it became a code bug. This is the highest-value use of diagrams: as a communication tool that forces precision.

Diagrams are not decoration. A diagram that exists to make documentation look professional, without being checked against the system it depicts, is worse than no diagram — it signals rigor without delivering it.

## Diagram rot is worse than no diagram

An outdated diagram actively misleads. An engineer who reads an outdated flowchart and builds a mental model of the system based on it will make incorrect decisions — and may not discover the error until much later.

The risk scales with the diagram's apparent authority. A hand-drawn sketch on a whiteboard photo is obviously provisional. A polished Mermaid diagram in the main docs looks official.

Prevention:
- Diagrams live in the same file as the prose they visualize. When the prose changes, the diagram is visible and likely to be updated in the same edit.
- Do not generate diagrams from code (e.g., auto-generated UML). Auto-generated diagrams are always up-to-date but are almost always too detailed to be useful.
- Include a "last verified" comment if a diagram describes an external dependency or a system boundary that could change without a code change.

Detection: during PR review, check whether changed logic or flow corresponds to a diagram change. If the code changed but the diagram didn't, either the change was non-architectural (no diagram update needed) or the diagram is now stale (fix it).

## The complexity budget

If a diagram requires more than 12-15 nodes, split it into sub-diagrams. This is not a style preference — it's a practical constraint on human working memory. Diagrams with 20+ nodes are not read; they are skimmed for orientation and then ignored in favor of reading the code directly.

When you feel the urge to add another node to an already-dense diagram, ask: is this diagram trying to describe too much at once? The answer is usually yes. Split by:
- **Level of abstraction**: system-level diagram + component-level diagram
- **Phase**: happy path diagram + error handling diagram
- **Actor**: one diagram per major actor in a multi-actor system

## Common mistakes

- **Too much detail**: showing function names, parameter types, and error codes in a flowchart. That information belongs in code comments or API docs. Diagrams communicate structure and flow, not implementation.
- **Unlabeled edges**: a diagram where all arrows look the same forces the reader to infer relationships. Label edges with the condition, event, or data that flows along them.
- **Mixed abstraction levels**: showing microservices and individual function calls in the same diagram. The diagram can't serve both the architect (who needs the big picture) and the implementer (who needs the detail).
- **Passive node names**: nodes labeled "Data Processing" instead of "Validate and normalize input." Active, specific labels make diagrams self-documenting.

## Sequence diagrams vs flowcharts

Use sequence diagrams when:
- Multiple actors interact (client, server, database, external service)
- Request/response patterns matter (who initiates, who responds, in what order)
- Timing or ordering is the key insight (what can happen in parallel, what must be sequential)

Use flowcharts when:
- A single actor moves through a process with decision points
- The question is "what happens next?" not "who talks to whom?"
- You're describing a state machine or lifecycle

A common mistake is using a flowchart for a multi-actor system. When the boxes start having roles (User, API, DB), you've outgrown flowcharts — switch to a sequence diagram.

## The 30-second verbal test

Before committing a diagram, try describing it verbally to an imaginary colleague over the phone, without them seeing it. If you can't summarize the structure in 30 seconds, the diagram is too complex. The constraint is not arbitrary — if it can't be explained in 30 seconds, it can't be held in working memory, and it won't be understood on first read.

## When not to add a diagram

- Simple sequential lists with no branching (prose is clearer)
- Configurations or schemas (a table is more useful)
- Anything you'd need to update every time implementation details change (too tight a coupling to code)
- Content where the diagram would just restate the prose without clarifying it
