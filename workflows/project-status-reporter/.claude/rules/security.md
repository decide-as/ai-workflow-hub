# Security Rules

## Secrets and credentials

- Never commit secrets, API keys, tokens, or passwords to the repository.
- Use `.env` files for local secrets and `.envsample` as a template (without values).
- Ensure `.env` is listed in `.gitignore`.
- If you accidentally commit a secret, rotate it immediately — git history is permanent.

## Input handling

- Validate and sanitize all external input (user input, API responses, file contents).
- Use parameterized queries for database operations — never interpolate strings into SQL.
- Escape output appropriately for the context (HTML, shell, SQL).

## Dependencies

- Pin major versions in requirements to avoid surprise breaking changes.
- Review dependency changelogs before major upgrades.
- Prefer well-maintained packages with active security response teams.

## Dependency scanning

- Use `pip-audit` (Python) or `npm audit` (Node) to check for known vulnerabilities.
- Run before every PR when the quality gate is `basic` or `strict`.
- Fix or pin around vulnerable dependencies promptly.

## Static security analysis

- Use `bandit` (Python) for static security analysis when the quality gate is `strict`.
- Run: `bandit -r <package>/ -q`
- Address all findings before merging. False positives can be suppressed with `# nosec` and a comment explaining why.

## File operations

- Use `pathlib` for path manipulation — never concatenate raw strings.
- Validate file paths to prevent directory traversal attacks.
- Set appropriate file permissions when creating files with sensitive content.
