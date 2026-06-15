# Autonomous Execution

## Bug fixing

When given a bug report, fix it. Do not ask for hand-holding or confirmation before investigating. The expected workflow:

1. Read the relevant code, logs, errors, or failing tests.
2. Identify the root cause.
3. Implement the fix.
4. Run tests to verify.
5. Commit.

Ask the user only when the root cause is ambiguous and there are multiple valid fixes with different tradeoffs. For straightforward bugs, just fix and commit.

## Failing CI and tests

When tests or CI checks fail, fix them without being told. Do not report the failure and wait for instructions — diagnose the cause and resolve it. This applies to:

- Test failures after your own changes.
- Lint or type-check errors introduced by your changes.
- Pre-commit hook failures.

If the failure is in code you did not write and the fix is non-obvious, flag it to the user rather than guessing.

## Root causes, not band-aids

Find and fix root causes. Do not apply temporary workarounds, suppress errors, or patch symptoms.

Signs you are applying a band-aid:

- Adding a `try/except: pass` to silence an error.
- Skipping a test instead of fixing what it caught.
- Adding a special case for one input instead of fixing the general logic.
- Using `# type: ignore` or `# noqa` to suppress a valid warning.

If the proper fix is too large for the current scope, flag it to the user and explain why — but do not quietly apply a workaround.
