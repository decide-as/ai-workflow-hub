# Code Review

## The core purpose

The reviewer's job is to find the bug the author can't see because they wrote it. This is not about style or correctness in the abstract — it's about exploiting the cognitive gap between the person who knows exactly what the code is supposed to do and the person who has to infer it from the code alone. Every reviewer note that says "this is confusing" is a data point about where the implementation diverges from its intent.

## Reviewing AI-generated code

AI-generated code has failure modes that human-written code doesn't. Review it with different priors:

- **Plausible but wrong**: the code looks idiomatic, compiles, passes obvious tests, and is subtly incorrect for an edge case the AI didn't model. The most dangerous category. Look for off-by-one errors in boundary conditions, incorrect handling of empty inputs, and race conditions in async code.
- **Correct but fragile**: the code solves the immediate problem but makes assumptions that will break when requirements change. Watch for hardcoded constants where a lookup should be, string matching where an enum should be, and copy-paste patterns where abstraction should be.
- **Over-engineered**: the AI produced a general solution for a specific problem, adding indirection that nobody asked for and complexity that will confuse maintainers. Ask whether the abstraction earns its keep.
- **Hallucinated APIs**: AI confidently uses library methods that don't exist, or uses real methods with wrong argument signatures. Run the code; do not assume it works because it looks right.

When the entire PR is AI-generated, increase your scrutiny of the test suite — AI tests often test the implementation rather than the requirement, meaning the tests and the code are wrong in the same way.

## The LGTM-after-one-round trap

Some reviewers always approve after one round regardless of what the author changed. This is a social failure, not a technical one. Signs of rubber-stamping:

- Reviewer comments are all stylistic (never architectural or behavioral)
- Every review takes the same amount of time regardless of PR size
- The reviewer never asks "what does this do when X?"

If you're the author and you receive rubber-stamp reviews, you are accruing hidden debt. If you're a team lead and you observe it, address it directly — the reviewer may not have enough context on the system to review effectively, and the fix is pairing or context-sharing, not criticism.

## Review for deletion

The most impactful review comments remove code. Every line of code is a liability: it can have bugs, it needs to be read by future maintainers, it must be kept consistent with the rest of the system. Before approving, ask:

- Is there a library function that replaces this block?
- Is this feature actually needed, or is the author solving a hypothetical?
- Is this abstraction justified by current requirements, or is it YAGNI?
- Can this logic be moved closer to the call site to remove the indirection?

A PR that removes 200 lines and adds 50 is almost always better than one that adds 250.

## When to block vs when to merge-and-follow-up

Blocking a PR has a real cost: the author context-switches away, re-reviews take hours of calendar time, and if the CI queue is long, latency compounds. Reserve hard blocks for:

- Correctness bugs (wrong behavior, data loss risk, security issues)
- Architectural violations that will cause larger pain if merged (the wrong abstraction, the wrong ownership boundary)
- Missing tests for genuinely critical paths

Merge-and-follow-up is appropriate for:

- Style and readability improvements that don't affect behavior
- Non-critical refactoring opportunities
- Documentation gaps
- Performance concerns without evidence of a real problem

Create a tracked issue for the follow-up. "Merge and follow up" without a ticket is "merge and forget."

## Handling PRs that are too large

Reviewing a 2000-line PR is theater. A human cannot hold 2000 lines of context simultaneously — you will miss things, and the author knows you'll miss things, which undermines the entire exercise.

The options:

1. **Ask for a split before reviewing**: identify the independent commits (refactors, behavior changes, tests) and ask the author to stack them as separate PRs. Takes a day; worth it.
2. **Review by commit**: if the commits are clean and atomic, review each commit independently rather than the whole diff. This works when the author has discipline.
3. **Focus the review**: explicitly scope your review to the highest-risk sections (new logic, security-sensitive paths, data model changes) and document what you didn't review. This is a risk acknowledgment, not an approval.

The worst option: approve a large PR without comment. It signals that large PRs are acceptable, and you'll see more of them.

## Performance review

You cannot review performance by reading code. Static analysis tells you the algorithmic complexity in theory; it tells you nothing about constant factors, memory allocation patterns, cache behavior, lock contention, or real-world input distributions. Before blocking a PR on performance grounds:

1. Do you have benchmark data showing the current code is fast enough?
2. Do you have a profile showing where time is actually spent?
3. Does the change touch a code path that is measurably on the critical path?

If the answer to all three is no, "this looks slow" is an opinion, not a review comment. Flag it as a risk to investigate, not a block. If you do have data, cite it: "the p99 latency on this endpoint is 400ms; this change adds a synchronous DB call per request in the hot path."

## The cognitive bias problem

Authors test what they intend, not what they wrote. This is not carelessness — it's how human memory works. The author holds the intended behavior in working memory while reading the code, which makes the gap between intent and implementation invisible to them. The reviewer's structural advantage is not knowing what the code is supposed to do, which forces reading what it actually does.

This means the best review questions are not "is this correct?" but "what does this code do when the input is empty? when the network fails? when two requests arrive simultaneously?" — the scenarios the author didn't explicitly hold in mind when writing.
