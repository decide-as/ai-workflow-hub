---
name: handover
description: Generate a structured cross-session briefing document so a fresh Claude can continue work without re-explanation
user-invocable: true
---

# Session Handover

A handover is a structured briefing document — like a doctor briefing her colleague at a shift change. It captures working state that neither context checkpoints (intra-session) nor memory files (long-term facts) preserve: what is being built right now, decisions locked in, critical context, what to do next, and open questions.

## When to invoke

- `/handover` — generate or update a handover for the current session
- `/handover resume` — load an existing handover at the start of a new session

## Persistence and scope

- Stored at `.claude/handover-<branch-slug>.md` (gitignored, one per branch)
- Derive the branch slug: `git branch --show-current | tr '/' '-'`
- Ephemeral working state — not version-controlled, not long-term memory

| Mechanism | When | Lifecycle | Who reads |
|---|---|---|---|
| Checkpoint (`.claude/session-state-<branch>.md`) | Mid-workflow compaction | Deleted on workflow completion | Same session, post-compaction |
| Handover (`.claude/handover-<branch>.md`) | Cross-session continuity | Manual — persists until overwritten | Fresh session |
| Memory (`~/.claude/projects/.../memory/`) | Long-term user/project facts | Manual — persistent | Any future session |

---

## Generate procedure

### Step 1: Check for existing handover

```bash
BRANCH_SLUG=$(git branch --show-current | tr '/' '-')
HANDOVER_FILE=".claude/handover-${BRANCH_SLUG}.md"
```

If the file exists, ask: "A handover exists for this branch. Update it or replace it?"
- **Update**: read the existing file first, then revise in place.
- **Replace**: write fresh from current context.

### Step 2: Gather context

Run these in parallel:

```bash
git log --oneline -10                    # recent commits
git diff --name-only origin/develop..HEAD  # changed files (adjust base branch)
git status --short                       # uncommitted state
```

Also read (if present):
- `.claude/session-state-${BRANCH_SLUG}.md` — active checkpoint
- Relevant PRD from `docs/prds/` for the current work
- Any open questions from the current conversation

### Step 3: Generate the five sections

Write the handover using the template below. Keep the total document between 40 and 80 lines. Omit sections with nothing meaningful to say. Do not copy code verbatim — use file references with line numbers.

### Step 4: Write and confirm

```bash
# Write to the handover file
```

Print a one-line confirmation: "Handover written to `.claude/handover-${BRANCH_SLUG}.md`."

---

## Resume procedure

When the user says "resume" and a handover file exists for the current branch:

### Step 1: Detect

```bash
BRANCH_SLUG=$(git branch --show-current | tr '/' '-')
HANDOVER_FILE=".claude/handover-${BRANCH_SLUG}.md"
```

If the file does not exist, say: "No handover found for this branch."

### Step 2: Read the handover

Read `.claude/handover-${BRANCH_SLUG}.md` in full.

### Step 3: Read supporting files

Read the PRD referenced in the handover (if any). Read the files referenced in the "Building" section to orient yourself in the current code state.

### Step 4: Summarize and continue

Print a brief summary:
- What is being built
- Where we left off
- What to do next

Then begin the next task without asking the user to re-explain context.

---

## Handover document template

```markdown
# Handover: <branch-slug>

**Updated:** <YYYY-MM-DD>
**Branch:** <branch-name>
**PRD:** <path to PRD if one exists, else "none">

## Building

<1-3 sentences: what is being built and why. Include the PRD reference and key file paths.>

## Decisions

- <Decision and the rationale that locked it in>
- <Another decision>

## Context

<Critical context a fresh session needs: constraints, tricky dependencies, what was tried and failed, warnings.>

## Next

<Concrete next step(s). Be specific enough that a fresh session can start immediately.>

## Open Questions

- <Unresolved question and what is blocking it>
```

---

## Size discipline

- **Total document**: 40–80 lines. Handovers that grow beyond 80 lines waste context on the next read.
- **Building**: 1–3 sentences, no more.
- **Decisions**: bullet list, one decision per bullet, rationale in the same bullet.
- **Context**: the hardest-to-rediscover information only. Skip what is obvious from the code.
- **Next**: concrete enough to act on without asking clarifying questions.
- **Open Questions**: only unblocked-but-unresolved items. Remove closed questions.

## What NOT to include

- Verbatim code — use `file.py:42-51` references instead.
- Dates, version numbers, or paths that can be re-derived with a command.
- Information already in memory files or CLAUDE.md.
- Step-by-step history of what was done — only the current state matters.
