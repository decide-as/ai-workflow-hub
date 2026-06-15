# CLAUDE.md — Project Instructions

## What it is

A markdown file that provides persistent instructions and context to Claude Code. It is automatically loaded into Claude's context at the start of every conversation, making it the primary way to teach Claude about your project.

## Where it lives

Claude Code loads CLAUDE.md from multiple locations, merged in order:

1. `~/.claude/CLAUDE.md` — Global, applies to all projects
2. `CLAUDE.md` at project root — Shared with team via git
3. `.claude/CLAUDE.md` — Project-specific, can be gitignored
4. `CLAUDE.md` in parent directories — Inherited by subdirectories

All are merged together. Higher-specificity files (project) can override lower ones (global).

## When to use

- Define project architecture and conventions
- Document key file paths and patterns
- Set coding standards and preferences
- Explain domain-specific terminology
- Provide context that applies to nearly every interaction

## When NOT to use

- One-off workflows → use Skills instead
- Automated side-effects → use Hooks instead
- Secret/local-only config → use `.claude/settings.local.json` instead
- Topic-specific rules that bloat the file → split into `.claude/rules/`

## Best practices

- Keep it concise — every line consumes context window
- Lead with the most important information
- Use bullet points over prose
- Update it as the project evolves
- Link to rules files for detailed topics

## Examples

### 1. Project overview and architecture

```markdown
# MyApp

FastAPI backend with React frontend. PostgreSQL for persistence, Redis for caching.

## Structure
- `api/` — FastAPI routes and middleware
- `core/` — Business logic, no framework dependencies
- `models/` — SQLAlchemy models
- `web/` — React TypeScript frontend
```

### 2. Coding conventions

```markdown
## Conventions
- Python 3.12+, ruff for linting (line length 99)
- Type hints on all public function signatures
- snake_case for Python, camelCase for TypeScript
- Prefer f-strings over .format()
- Use pathlib for all file operations
```

### 3. Testing instructions

```markdown
## Testing
- Run: `pytest tests/ -v`
- Lint: `ruff check . && ruff format --check .`
- Frontend: `cd web && npm test`
- Always run tests before committing
- Use fixtures in conftest.py for shared setup
```

### 4. Key domain terminology

```markdown
## Domain glossary
- **Tenant**: An organization using our platform (multi-tenant SaaS)
- **Workspace**: A sub-unit within a tenant, has its own settings
- **Pipeline**: A sequence of data transformation steps
- **Run**: A single execution of a pipeline
```

### 5. API design standards

```markdown
## API conventions
- RESTful endpoints under `/api/v1/`
- Use HTTP status codes correctly (201 for creation, 204 for deletion)
- Pagination: `?page=1&per_page=50`, return `X-Total-Count` header
- Error responses: `{"error": "message", "code": "UNIQUE_CODE"}`
- All endpoints require Bearer token auth except `/health`
```

### 6. Database patterns

```markdown
## Database
- Alembic for migrations: `alembic revision --autogenerate -m "description"`
- All tables have `id` (UUID), `created_at`, `updated_at` columns
- Soft delete via `deleted_at` timestamp, never hard delete user data
- Use database-level constraints, not just application validation
```

### 7. Git workflow instructions

```markdown
## Git
- Commit messages: conventional commits (feat:, fix:, chore:)
- Branch from main, PR back to main
- Squash merge all PRs
- Never force push to main
```

### 8. Environment and dependencies

```markdown
## Setup
- Python: `uv sync` to install dependencies
- Frontend: `cd web && bun install`
- Environment: copy `.env.example` to `.env` and fill in values
- Docker: `docker compose up -d` for PostgreSQL and Redis
```

### 9. Deployment context

```markdown
## Deployment
- CI/CD via GitHub Actions (`.github/workflows/`)
- Staging: auto-deploy on push to `develop`
- Production: manual trigger after PR merge to `main`
- Infrastructure: Terraform in `infra/`, do not modify without review
```

### 10. File ownership and boundaries

```markdown
## Boundaries
- `core/` must NOT import from `api/` — dependencies flow inward
- `models/` are shared between api and core
- `web/` is a standalone SPA, communicates only via REST API
- Generated files in `gen/` — never edit manually, regenerate with `make gen`
```
