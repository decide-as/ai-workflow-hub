# Checkpoints — Session Snapshots and Rewind

## What it is

An automatic snapshot system that captures session state at key points, allowing you to rewind to a previous state if Claude goes down the wrong path. Checkpoints track file edits made through Claude's tools — think of it as session-level undo.

## How to use

| Command | What it does |
|---------|-------------|
| `/rewind` | Show checkpoint history and rewind to a chosen point |

## When to use

- Claude made changes you don't want — rewind instead of manually reverting
- An approach isn't working and you want to try a different strategy
- You want to explore an idea without committing to it
- Claude misunderstood the requirements and went in the wrong direction
- You want to compare before/after states

## When NOT to use

- Changes were made via Bash commands (not tracked by checkpoints)
- You already committed the changes (use git revert instead)
- You want to undo changes from a previous session (checkpoints are per-session)
- External tools modified files outside of Claude (not tracked)

## What's tracked vs. not tracked

| Tracked | Not tracked |
|---------|-------------|
| File edits via Edit tool | Bash commands (rm, mv, sed) |
| File writes via Write tool | Git operations (commit, push) |
| File deletions via tools | External editor changes |
| | Database modifications |
| | Network requests |

## How it works

```mermaid
flowchart TD
    Edit1[Edit file A] --> CP1([Checkpoint 1])
    CP1 --> Edit2[Edit file B]
    Edit2 --> CP2([Checkpoint 2])
    CP2 --> Edit3[Edit file A again]
    Edit3 --> CP3([Checkpoint 3])
    CP3 --> Stuck{Wrong path?}

    Stuck -->|yes| Rewind[/rewind to CP1]
    Rewind --> Restored[File A and B<br/>restored to CP1 state]

    Stuck -->|no| Continue[Continue working]
```

## Examples

### 1. Rewind after a wrong approach

```
User: Refactor the auth module to use JWT
Claude: *makes 15 file edits implementing JWT*

User: Actually, let's use session-based auth instead.
User: /rewind

[Shows checkpoint list]
> Checkpoint 1: Before auth refactor (15 files changed)
> Checkpoint 2: After adding JWT middleware (3 files changed)
> Checkpoint 3: After updating all routes (12 files changed)

User: Rewind to checkpoint 1

[All 15 files restored to their pre-refactor state]
User: Now implement session-based auth instead.
```

### 2. Exploratory coding

```
User: Try implementing this with a state machine pattern.
Claude: *implements state machine across 4 files*

User: Hmm, I don't love this approach. /rewind
[Back to before the state machine]

User: Try it with a simple switch/case instead.
Claude: *implements simpler approach*

User: Much better.
```

### 3. Recovering from a misunderstanding

```
User: Clean up the tests
Claude: *interprets "clean up" as "delete unused tests"*
       *removes 8 test functions*

User: No! I meant format them, not delete them. /rewind
[All test functions restored]

User: Format the test files — fix indentation and organize imports.
```

### 4. Incremental experimentation

```
User: Add caching to the API handlers

Claude: *adds caching to handler 1* → Checkpoint
Claude: *adds caching to handler 2* → Checkpoint
Claude: *adds caching to handler 3, but introduces a bug* → Checkpoint

User: Handler 3's caching looks wrong. /rewind
[Rewind to after handler 2]

User: For handler 3, use a different cache strategy because it has user-specific data.
```

### 5. Quick A/B comparison

```
User: Implement the sort function
Claude: *implements quicksort*

User: /rewind
User: Now implement it with mergesort instead
Claude: *implements mergesort*

User: The quicksort was better for our use case. /rewind
[Back to quicksort implementation]
```

### 6. Rewinding part of a multi-step task

```
User: Set up the database layer: models, migrations, and seed data

Claude: *creates models* → Checkpoint 1
Claude: *creates migrations* → Checkpoint 2
Claude: *creates seed data with wrong test values* → Checkpoint 3

User: The seed data isn't right. /rewind to checkpoint 2
[Models and migrations preserved, seed data reverted]

User: Use realistic sample data for the seeds, not lorem ipsum.
```

### 7. Undoing an aggressive refactor

```
User: Simplify the error handling in src/api/

Claude: *consolidates 12 specific error handlers into 3 generic ones*
       *removes error context that was actually important*

User: That lost too much specificity. /rewind
[All error handlers restored to their original specific forms]

User: Keep the specific handlers but extract the common try/catch pattern.
```

### 8. Safe exploration of risky changes

```
User: What if we removed the backwards compatibility layer?

Claude: *removes compat layer, updates call sites*
       *8 files changed*

User: How many things broke?
Claude: *runs tests* — 23 failures

User: Too many. /rewind
[All files restored, compat layer back]

User: Let's deprecate it gradually instead.
```

### 9. Checkpoint after each logical step

Claude automatically creates checkpoints at natural boundaries:
- After editing a group of related files
- Before starting a new logical step
- After completing a requested change

This means you can rewind to any logical step, not just individual file edits.

### 10. Combining rewind with git

```
User: /rewind
[Reverts uncommitted file changes to checkpoint state]

# If changes were already committed:
git revert HEAD    # Better tool for committed changes
git reset HEAD~1   # Or this for local-only commits
```

Checkpoints and git serve different scopes:
- **Checkpoints**: undo within the current session, before committing
- **Git**: undo committed changes, across sessions
