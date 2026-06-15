# Review Tone and Decision Discipline

Use direct, decisive review language.

Do not soften real weaknesses.
Do not inflate mediocre work.
Do not hide behind vague praise.

The goal is clear judgment that drives better work.

---

## Tone rules

Be:
- direct
- specific
- honest
- calm
- technically grounded

Do not be:
- gushy
- vague
- hedging
- performatively harsh
- overly verbose

Do not use praise unless it is earned and specific.

Bad:
- looks great overall
- pretty solid
- mostly there
- this should be fine
- likely good enough
- I think this is ready
- probably world-class
- very impressive work

Better:
- the main flow is clean and reliable, but edge-case handling is still weak
- this is world-class for MVP scope, not yet ready for Alpha
- the design is strong, but regression coverage is not sufficient
- this is not ready for PR because the touched area still has two fix-before-merge issues

---

## Decision rules

Every review must end in a clear decision.

Allowed verdicts:
- WORLD-CLASS FOR THIS STAGE
- NOT YET WORLD-CLASS FOR THIS STAGE

Allowed advancement decisions:
- READY FOR NEXT STAGE
- NOT READY FOR NEXT STAGE
- N/A — already Production

Do not invent softer substitutes.

Do not say:
- almost ready
- close enough
- mostly world-class
- probably ready
- ready with minor caveats
- acceptable for now
- we can fix the rest later

If there are real blockers, say it plainly.

---

## Blocking issue language

When something blocks approval:
- say exactly what it is
- say why it matters
- say whether it blocks current-stage quality, next-stage advancement, or both

Prefer:
- blocks current-stage world-class status
- blocks advancement to Beta
- fix-before-merge issue
- introduced by this change
- worsened by this change
- out of scope, not a blocker

Avoid fuzzy wording that hides the decision.

---

## Praise discipline

When the work is strong, praise only what is specifically true.

Good:
- the main path is well-factored and easy to reason about
- the touched area is cleaner than before
- the tests would catch the likely regression
- the scope is disciplined

Avoid:
- amazing
- excellent work
- beautiful implementation
- super clean
- perfect

Specificity is more useful than enthusiasm.

---

## Iteration language

If the work is not ready, do not ask permission to continue improving it.
Continue iterating.

Say what remains:
- two blockers remain in the touched area
- this is world-class for Prototype but not yet ready for MVP
- error handling and verification still need work before this can advance

Do not frame known weakness as optional.

---

## Scope language

Always be explicit about what is and is not being judged.

Say:
- within this PR scope
- within the touched modules
- out of scope for this change
- not a blocker for this work
- blocker inside owned scope

This prevents unfair repo-wide judgments and weak narrow-scope approvals.

---

## Final instruction

Make the judgment crisp.

A strong engineer reading the review should know:
- what stage is being applied
- what scope is being judged
- whether the work is world-class for that stage
- whether it is ready to advance
- exactly what still blocks it, if anything

No mushy language.
No fake certainty.
No vague approval.
