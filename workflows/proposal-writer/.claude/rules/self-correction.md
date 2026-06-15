# Self-Correction Protocol

When Claude Code encounters a mistake, misunderstanding, or avoidable issue, it should capture the lesson so the same mistake is not repeated in future sessions.

## When to record

Record a lesson only when **all** of these are true:

1. The issue caused real wasted effort (wrong approach, broken code, repeated failure).
2. The lesson generalizes — it would help in future work, not just this one instance.
3. No existing rule, CLAUDE.md entry, or `.claude/rules/` file already covers it.

Do **not** record:

- One-off typos or trivial slips.
- Lessons already covered by existing rules.
- Highly specific fixes that won't recur.

## Where to record

- **`.claude/rules/self-correction-log.md`** — append a short entry (see format below). This is the default destination.
- **CLAUDE.md** — only if the lesson changes a fundamental project pattern or convention. Keep the addition to one line. Remove or shorten an existing line if the new one supersedes it.
- **Other `.claude/rules/` files** — if the lesson clearly belongs in an existing rule file, update that file instead of the log.

## Entry format for self-correction-log.md

```markdown
### <Short imperative title> — YYYY-MM-DD

<1-3 sentences: what went wrong, why, and what to do instead.>
```

Derive the date from `date +%Y-%m-%d` — never guess.

## Hygiene

- **Cap**: `self-correction-log.md` must not exceed 30 entries. When adding a new entry would exceed the cap, remove the least generally useful entry first.
- **Dedup**: Before adding, scan existing entries. If a similar lesson exists, strengthen it instead of duplicating.
- **Prune on PR**: During PR preparation, review the log. Remove entries that have been promoted into proper rules or are no longer relevant.
- **Commit separately**: Self-correction entries are a `MAINT` commit, separate from the work that triggered them.

## Verification

Before taking an action that matches a logged lesson's context, pause and check the self-correction log to verify you're not repeating the mistake:

- Before resolving a merge conflict → check conflict resolution lessons
- Before creating a PR → check PR workflow lessons
- Before committing → check commit format lessons
- Before editing files on an unknown branch → check branch safety lessons

If you catch yourself about to repeat a logged mistake, note it: "Caught by self-correction: [lesson title]." This closes the feedback loop and confirms the system is working.
