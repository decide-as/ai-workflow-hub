# Rules — Topic-Specific Instructions

## What it is

Markdown files in `.claude/rules/` that break CLAUDE.md into focused, topic-specific instruction sets. Like CLAUDE.md, they are always loaded into context at conversation start.

## Where it lives

- `~/.claude/rules/` — Global rules, apply to all projects
- `.claude/rules/` — Project-specific rules, checked into git
- `.claude/rules/subdir/` — Can be nested for organization

All `.md` files in these directories are automatically discovered and loaded.

## When to use

- A topic is important enough to always be in context but would bloat CLAUDE.md
- You want to share specific rules across projects (symlink from global)
- You need modular, independently maintainable instruction sets
- Team members need to update rules without merge conflicts in a single file

## When NOT to use

- Rarely-needed instructions → use Skills instead (on-demand loading)
- Information that varies per developer → use `.claude/settings.local.json`
- Executable automation → use Hooks instead

## Best practices

- One topic per file, named descriptively (`git.md`, `testing.md`, `security.md`)
- Keep each file focused — if it covers multiple unrelated topics, split it
- Use subdirectories for grouping (`conventions/python.md`, `conventions/typescript.md`)
- Remember: every rule file consumes context window space

## Examples

### 1. Git commit conventions

```markdown
# Git Commit Rules

## Message format
- First line: max 50 chars, imperative mood ("Add feature" not "Added feature")
- Prefix with type: feat:, fix:, docs:, style:, refactor:, test:, chore:
- Body: wrap at 72 characters, explain why not what
- Reference issues: "Closes #123" in the footer

## Branching
- Feature branches: `feature/<short-description>`
- Bug fixes: `fix/<issue-number>-<description>`
- Always merge the target branch (e.g. main/master) into your branch before PR
```

### 2. Code review standards

```markdown
# Code Review Rules

## Before requesting review
- All tests pass locally
- Linter has zero warnings
- Self-review the diff — remove debug code, TODOs, commented-out code
- PR description explains the "why", not just the "what"

## When reviewing
- Check for correctness first, style second
- Verify error handling and edge cases
- Look for missing tests for new logic paths
- Flag security concerns as blocking
```

### 3. Error handling conventions

```markdown
# Error Handling

## Python
- Use custom exception hierarchy rooted at `AppError`
- Never catch bare `except:` — always specify the exception type
- Log errors with context (user_id, request_id, input values)
- Return structured error responses from API endpoints

## Categories
- `ValidationError` — invalid user input (400)
- `NotFoundError` — resource doesn't exist (404)
- `AuthorizationError` — insufficient permissions (403)
- `ExternalServiceError` — third-party API failure (502)
```

### 4. Database migration rules

```markdown
# Database Migrations

## Creating migrations
- Always use `alembic revision --autogenerate -m "descriptive name"`
- Review generated migration before committing — autogenerate misses some changes
- One logical change per migration file
- Never modify a migration that has been applied to staging or production

## Naming
- Use descriptive names: `add_user_email_index`, `create_audit_log_table`
- Never use generic names like `update_models` or `migration_001`

## Safety
- All migrations must be reversible (implement `downgrade()`)
- Add indexes concurrently on large tables: `op.create_index(..., postgresql_concurrently=True)`
- Test migrations against a copy of production data before deploying
```

### 5. API versioning policy

```markdown
# API Versioning

## Rules
- All endpoints live under `/api/v{N}/`
- Breaking changes require a new major version
- Deprecated endpoints return `Sunset` header with removal date
- Support at most 2 major versions simultaneously
- Document breaking changes in CHANGELOG.md under "API Breaking Changes"

## What counts as breaking
- Removing or renaming a field in a response
- Changing the type of an existing field
- Removing an endpoint
- Changing authentication requirements
- Making a previously optional parameter required
```

### 6. Security and secrets

```markdown
# Security Rules

## Secrets
- Never commit secrets, API keys, or tokens — use environment variables
- `.env` is gitignored; `.env.example` is committed (without values)
- Rotate any secret that appears in git history immediately

## Input validation
- Validate all user input at the API boundary
- Use parameterized queries — never interpolate into SQL
- Sanitize HTML output to prevent XSS
- Validate file uploads: check MIME type, size, and extension

## Authentication
- JWT tokens expire after 15 minutes; refresh tokens after 7 days
- Rate limit login attempts: 5 per minute per IP
- Hash passwords with bcrypt (cost factor 12)
```

### 7. Logging standards

```markdown
# Logging Standards

## Levels
- DEBUG: Detailed diagnostic info (disabled in production)
- INFO: Normal operations (request served, task completed)
- WARNING: Unexpected but recoverable (deprecated API called, retry needed)
- ERROR: Operation failed (database timeout, external API error)
- CRITICAL: Application cannot continue (missing config, corrupted state)

## Format
- Include: timestamp, level, logger name, request_id, message
- Structured JSON in production, human-readable in development
- Never log passwords, tokens, credit card numbers, or PII
```

### 8. Performance rules

```markdown
# Performance Rules

## Database
- Every query must use an index — no full table scans on tables > 10k rows
- N+1 queries are bugs — use eager loading or batch queries
- Add `EXPLAIN ANALYZE` output to PR description for new complex queries

## API
- Response time budget: p95 < 200ms for reads, < 500ms for writes
- Paginate all list endpoints (max 100 items per page)
- Use ETags and If-None-Match for cacheable responses

## Frontend
- Lazy-load routes and heavy components
- Images must use responsive srcset
- Bundle size budget: < 200KB gzipped for initial load
```

### 9. Dependency management

```markdown
# Dependency Management

## Adding dependencies
- Check license compatibility before adding (MIT, Apache 2.0, BSD are OK)
- Prefer well-maintained packages (recent commits, active issues)
- Pin exact versions in lock files, minimum versions in pyproject.toml
- Document why each non-obvious dependency was added

## Updating
- Run `uv lock --upgrade` weekly to catch security patches
- Review changelogs before major version bumps
- Run full test suite after any dependency update
- Never update dependencies in the same PR as feature work
```

### 10. Documentation conventions

```markdown
# Documentation Rules

## Code documentation
- Docstrings on all public functions and classes (Google style)
- No docstrings on private helpers unless the logic is non-obvious
- Type hints are documentation — prefer them over docstring param descriptions
- Comments explain "why", not "what" — the code shows what

## Project documentation
- README.md: setup, usage, and contribution guide
- ARCHITECTURE.md: system design and component relationships
- CHANGELOG.md: user-facing changes per version (Keep a Changelog format)
- ADR (Architecture Decision Records) in `docs/adr/` for significant decisions
```
