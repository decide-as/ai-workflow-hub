# Subagent Strategy

## When to use subagents

Use subagents to keep the main context window clean and to parallelize independent work. Prefer subagents over doing everything inline when:

- **Research and exploration**: searching the codebase, reading multiple files, or answering "how does X work?" questions. Offload to an Explore agent rather than filling the main context with search results.
- **Parallel independent tasks**: when two or more tasks have no dependencies, run them as concurrent subagents instead of sequentially.
- **Complex analysis**: code review, risk evaluation, or test gap analysis that requires reading many files. The subagent returns a summary; the main context stays lean.

## When NOT to use subagents

- **Simple directed searches**: a single Glob or Grep call is faster than spawning an agent.
- **Tasks with tight dependencies**: if step 2 depends on step 1's exact output, run them sequentially in the main context.
- **Trivial tasks**: if a task takes one tool call, do it directly.

## One task per subagent

Each subagent should have a single, well-defined objective. A clear prompt produces a clear result. Avoid multi-purpose agents that try to research, plan, and implement in one shot.

Bad: "Research the auth system, find the bug, and fix it."
Good: "Find all authentication middleware files and describe how session tokens are validated." Then use the result to plan the fix in the main context.

## Don't duplicate work

If you delegate research to a subagent, do not also perform the same searches in the main context. Wait for the subagent's result and use it.
