# Skills — On-Demand Task Templates

## What it is

YAML-frontmatter markdown files that define reusable workflows Claude can execute. Unlike rules, skills are loaded on-demand — either when the user invokes them with `/skill-name` or when Claude auto-detects they are relevant.

## Where it lives

- `~/.claude/skills/skill-name/SKILL.md` — Personal, across all projects
- `.claude/skills/skill-name/SKILL.md` — Project-specific, shareable via git
- Inside plugins: `plugin/skills/skill-name/SKILL.md`

Each skill is a directory containing a `SKILL.md` file.

## When to use

- Multi-step workflows that don't need to be in every conversation
- Specialized tasks with specific tool requirements
- Complex processes you want to standardize across a team
- Reference material that is too large for always-loaded context

## When NOT to use

- Information needed in every conversation → use CLAUDE.md or Rules
- Deterministic automation (always run X after Y) → use Hooks
- External service integration → use MCP Servers

## Frontmatter options

```yaml
---
name: my-skill               # Slash command name (/my-skill)
description: "Short desc"    # When Claude should auto-invoke
user-invocable: true         # User can call via /my-skill (default: true)
disable-model-invocation: false  # If true, only user can trigger
allowed-tools: "Read, Grep, Bash"  # Restrict available tools
context: fork                # Run in isolated subagent context
agent: Explore               # Which subagent type to use
model: claude-sonnet-4-6     # Override model for this skill
---
```

## String substitutions

- `$ARGUMENTS` — All arguments passed to the skill
- `$0`, `$1`, `$2` — Individual positional arguments
- `${CLAUDE_SESSION_ID}` — Current session ID
- `${CLAUDE_SKILL_DIR}` — Path to the skill's directory
- `` !`command` `` — Execute shell command and embed output

## Examples

### 1. Code review skill

```markdown
---
name: review
description: "Review code changes for quality, security, and correctness"
allowed-tools: "Read, Grep, Glob, Bash, Agent"
---

Review the current git diff for:

1. **Correctness**: Logic errors, off-by-one, null handling, race conditions
2. **Security**: Injection, auth bypass, secret exposure, OWASP top 10
3. **Performance**: N+1 queries, unnecessary allocations, missing indexes
4. **Style**: Naming, consistency with codebase conventions
5. **Tests**: Coverage of new logic paths, edge cases

Run: `git diff HEAD~1` to get the changes.

For each issue found, cite the file and line number. Categorize as:
- 🔴 Blocking — must fix before merge
- 🟡 Suggestion — would improve quality
- 🟢 Nit — minor style preference

If no issues found, confirm the changes look good.
```

### 2. Deploy skill

```markdown
---
name: deploy
description: "Deploy to staging or production environment"
allowed-tools: "Bash, Read"
---

Deploy the application to the `$ARGUMENTS` environment.

## Pre-flight checks
1. Verify all tests pass: `pytest tests/ -v`
2. Verify no uncommitted changes: `git status --porcelain`
3. Verify on correct branch (staging=develop, production=main)

## Deploy steps
- **staging**: `./scripts/deploy.sh staging`
- **production**: Confirm with user first, then `./scripts/deploy.sh production`

## Post-deploy
1. Run smoke tests: `./scripts/smoke-test.sh $ARGUMENTS`
2. Check application health: `curl -f https://$ARGUMENTS.example.com/health`
3. Report deploy status with version hash
```

### 3. Database migration skill

```markdown
---
name: migrate
description: "Create and apply database migrations safely"
allowed-tools: "Bash, Read, Edit, Write"
---

Create a new database migration for: $ARGUMENTS

## Steps
1. Read current models in `models/` to understand schema
2. Generate migration: `alembic revision --autogenerate -m "$ARGUMENTS"`
3. Review the generated migration file for correctness
4. Check that downgrade() is implemented
5. Apply to dev database: `alembic upgrade head`
6. Run tests to verify: `pytest tests/ -v`

## Safety checks
- Never drop columns without user confirmation
- Data migrations must be separate from schema migrations
- Verify migration is reversible by running upgrade then downgrade
```

### 4. PR description generator

```markdown
---
name: pr-desc
description: "Generate a pull request description from branch commits"
allowed-tools: "Bash, Read"
---

Generate a PR description for the current branch.

1. Get the base branch: `git merge-base HEAD main`
2. Get commits: `git log --oneline main..HEAD`
3. Get full diff summary: `git diff --stat main..HEAD`

Write a PR description with:
- **Title**: concise summary (under 70 chars)
- **Summary**: 2-3 bullet points of what changed and why
- **Testing**: how to verify the changes
- **Screenshots**: note if UI changes need screenshots

Format for GitHub markdown.
```

### 5. Security audit skill

```markdown
---
name: security-audit
description: "Scan codebase for common security vulnerabilities"
allowed-tools: "Read, Grep, Glob, Agent"
context: fork
agent: Explore
---

Perform a security audit of the codebase. Check for:

1. **Hardcoded secrets**: API keys, passwords, tokens in source files
   - Search patterns: `password`, `secret`, `api_key`, `token`, `Bearer`
2. **SQL injection**: String interpolation in database queries
3. **XSS**: Unsanitized user input rendered in HTML
4. **Path traversal**: User-controlled file paths without validation
5. **Insecure deserialization**: `pickle.loads`, `yaml.load` without SafeLoader
6. **Command injection**: `os.system`, `subprocess.call` with shell=True
7. **Missing auth**: Endpoints without authentication decorators
8. **Weak crypto**: MD5, SHA1 for security purposes, ECB mode
9. **CORS misconfiguration**: Wildcard origins in production
10. **Dependency vulnerabilities**: Run `pip audit` or `npm audit`

Report findings with file paths, line numbers, and severity ratings.
```

### 6. Refactor skill

```markdown
---
name: refactor
description: "Refactor a module while preserving behavior"
allowed-tools: "Read, Edit, Write, Grep, Glob, Bash"
---

Refactor: $ARGUMENTS

## Process
1. Read the target code and understand its behavior
2. Identify all callers: `grep -r "function_name" --include="*.py"`
3. Run existing tests to establish baseline: `pytest tests/ -v`
4. Perform the refactoring
5. Run tests again to verify no regressions
6. Run linter: `ruff check . --fix`

## Principles
- Preserve all existing behavior (public API unchanged)
- Improve readability and reduce complexity
- Extract only if there are 3+ call sites
- Do not add features — only restructure
```

### 7. Onboarding skill (project context loader)

```markdown
---
name: onboard
description: "Explain the project architecture and key patterns"
allowed-tools: "Read, Glob, Grep"
context: fork
agent: Explore
---

Give a comprehensive overview of this project for a new developer.

1. Read README.md and ARCHITECTURE.md
2. Identify the tech stack from package files (pyproject.toml, package.json, etc.)
3. Map the directory structure and explain each top-level directory
4. Identify key patterns:
   - Entry points (main, CLI, API routes)
   - Data flow (request → handler → service → database)
   - Configuration loading
   - Error handling approach
   - Testing strategy
5. List the most important files (by import count and centrality)
6. Note any non-obvious conventions or gotchas
```

### 8. Changelog generator skill

```markdown
---
name: changelog
description: "Generate changelog entry from recent commits"
allowed-tools: "Bash, Read"
---

Generate a changelog entry for the latest release.

1. Find the last tag: `git describe --tags --abbrev=0`
2. Get commits since: `git log --oneline <tag>..HEAD`
3. Categorize each commit:
   - **Added**: New features
   - **Changed**: Changes to existing functionality
   - **Fixed**: Bug fixes
   - **Removed**: Removed features
   - **Security**: Vulnerability fixes

Format using Keep a Changelog conventions. Group by category, most important first.
Do not include merge commits or version bump commits.
```

### 9. Test generator skill

```markdown
---
name: gen-tests
description: "Generate tests for a module or function"
allowed-tools: "Read, Write, Grep, Glob, Bash"
---

Generate tests for: $ARGUMENTS

## Process
1. Read the target module/function
2. Identify all code paths (happy path, edge cases, error cases)
3. Read existing test patterns in `tests/` for style consistency
4. Generate test file mirroring source structure
5. Run the new tests: `pytest <test_file> -v`
6. Fix any failures

## Test quality
- One assertion per logical check
- Descriptive names: `test_returns_empty_list_when_no_items_found`
- Use parametrize for multiple inputs with same logic
- Mock only external dependencies (APIs, filesystem, time)
- Include at least: happy path, empty input, invalid input, boundary values
```

### 10. API documentation skill

```markdown
---
name: api-docs
description: "Generate or update API documentation from route definitions"
allowed-tools: "Read, Grep, Glob, Write"
---

Generate API documentation for: $ARGUMENTS

1. Find all route definitions (FastAPI decorators, Express routes, etc.)
2. For each endpoint, document:
   - Method and path
   - Description (from docstring or function name)
   - Request parameters (path, query, body with types)
   - Response format (status codes, body schema)
   - Authentication requirements
   - Example request/response

3. Output as markdown in `docs/api/`
4. Group endpoints by resource/router

Use the existing codebase conventions for documentation style.
```
