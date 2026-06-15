# Code Review Checklist

Use this checklist when reviewing code changes. Not every item applies to every change — focus on what is relevant.

## Correctness

- Does the code do what it claims to do?
- Are edge cases handled (empty inputs, missing data, boundary values)?
- Are error conditions caught and handled appropriately?

## Security

- No secrets, tokens, or credentials in code or config files.
- User input is validated and sanitized before use.
- No injection vectors (SQL, shell, template).
- File paths are validated to prevent directory traversal.

## Maintainability

- Naming is clear and follows project conventions.
- No dead code, commented-out code, or unused imports.
- Functions are focused — each does one thing.
- No unnecessary abstractions or premature generalizations.

## Testing

- New behavior has tests.
- Existing tests still pass.
- Edge cases and error paths are covered.
- Tests are readable and test behavior, not implementation.

## Documentation

- Public API changes are reflected in docstrings.
- README is updated if user-facing behavior changed.
- Non-obvious logic has a brief comment explaining why (not what).
