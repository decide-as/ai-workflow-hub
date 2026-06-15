# Workflow Planning

## When to plan

Enter plan mode before starting any task that involves 3 or more steps, architectural decisions, or changes across multiple files. Write out the steps before executing them.

For new features that span multiple files, use `/prd` instead — it generates a PRD and optional Design Doc. This rule covers everything else: refactors, migrations, debugging sessions, multi-step fixes, and configuration changes.

## Verify before starting

For mid-size tasks (not trivial, not big enough for `/prd`), state the plan and check in with the user before implementing. A one-sentence summary of the approach and a quick "sound good?" prevents wasted work on the wrong path.

Skip the check-in when:

- The task is unambiguous and has a single obvious approach.
- The user explicitly said to just do it.
- The fix is a direct response to a test failure or lint error.

## Stop and re-plan

If an approach is not working — tests keep failing, the design doesn't fit, or complexity is escalating — stop immediately. Do not push through a broken approach hoping it will work.

1. **Stop**: Finish the current atomic step (or revert it) but do not start the next one.
2. **Assess**: State what went wrong and why the current approach is failing.
3. **Re-plan**: Propose an alternative approach. If unsure, ask the user.
4. **Resume**: Continue only after the new plan is clear.

Two failed attempts at the same approach is the hard limit. After the second failure, you must re-plan or ask the user — never try a third time.

## Multi-session plans

For work expected to span multiple sessions **without an active PRD**, write a plan file at `.claude/plans/<branch-slug>.md`. Derive the branch slug with `git branch --show-current | tr '/' '-'`.

For work **with an active PRD**, do not create a plan file. The PRD's Success Criteria are the plan. Track execution progress in context checkpoints, and update the PRD status after merge.

Plan files are gitignored — they are local working state, like context checkpoints. They are visible only within the worktree where they were created.

### Template

```markdown
# Plan: <what we're building>

## Approach
<1-3 sentences on the chosen strategy and why>

## Steps
- [x] Step 1 — completed result
- [x] Step 2 — completed result
- [ ] Step 3 — next up
- [ ] Step 4

## Decisions
- <decision and rationale, added as they happen>
```

### Lifecycle

- **Create** when starting multi-session work without a PRD.
- **Update** as steps complete — check off items, add decisions.
- **Delete** when the work is done. Git history does not preserve plan files (they are gitignored), so deletion is final. The commit history tells the real story.
