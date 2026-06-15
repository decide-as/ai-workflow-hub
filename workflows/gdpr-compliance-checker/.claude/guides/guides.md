# Guides — On-Demand Reference Documentation

## What it is

Markdown files bundled into a project's `.claude/guides/` directory that serve as reference documentation for Claude. Guides are not loaded into every conversation — they're available on demand when Claude needs to understand how a feature or mechanism works.

## Where it lives

- `.claude/guides/` — Project-specific guides (checked into git)
- `README.md` inside `.claude/guides/` — Index of all available guides

## When to use

- Document how a Claude Code feature or extension mechanism works
- Provide reference material that Claude can consult when configuring a project
- Bundle usage documentation alongside the project so it's always available offline
- Teach Claude about project-specific workflows that don't fit in rules or CLAUDE.md

## When NOT to use

- Instructions Claude should follow every conversation → use CLAUDE.md or Rules
- Task-specific workflows with steps → use Skills
- Temporary context or learnings → use Memory
- API documentation for external services → use MCP servers

## How guides differ from other mechanisms

| Mechanism | Purpose | Loaded when |
|-----------|---------|-------------|
| CLAUDE.md | Instructions to follow | Every conversation |
| Rules | Detailed instructions by topic | Every conversation |
| Skills | Task workflows to execute | When invoked |
| Memory | Learnings across sessions | Index always, topics on demand |
| **Guides** | **Reference documentation** | **On demand, when relevant** |

## Guide file format

Guides are plain markdown files. No frontmatter required. Organize with headings, tables, code blocks, and mermaid diagrams as needed.

```markdown
# Feature Name — Short Description

## What it is
[One paragraph explanation]

## Where it lives
[File paths and configuration locations]

## When to use
[Bullet list of use cases]

## When NOT to use
[Bullet list of anti-patterns]

## Examples
[10 practical, real-world examples]
```

## Examples

### 1. Project-specific workflow guide

```markdown
# Deployment — How We Ship to Production

## Environments
- staging: auto-deploys from `develop` branch
- production: manual promotion from staging

## Steps
1. Merge PR to develop → staging auto-deploys
2. Verify on staging (check /healthz, run smoke tests)
3. Run `make promote-prod` to promote staging → production
4. Monitor Grafana dashboard for 15 minutes
```

### 2. Architecture reference guide

```markdown
# Data Pipeline — Event Processing Architecture

## Overview
Events flow: Kafka → Consumer → Transformer → PostgreSQL → Materialized Views

## Consumer groups
- `ingest-raw`: writes raw events to staging table
- `transform-enriched`: joins with user data, writes to enriched table
- `aggregate-hourly`: rolls up into hourly aggregates
```

### 3. API conventions guide

```markdown
# API Conventions — How Our REST API Works

## URL patterns
- Collections: GET /api/v1/users
- Single resource: GET /api/v1/users/:id
- Nested resources: GET /api/v1/users/:id/orders

## Authentication
Bearer token in Authorization header. Tokens issued by /api/v1/auth/login.

## Error format
{"error": {"code": "NOT_FOUND", "message": "User not found", "details": {}}}
```

### 4. Database guide

```markdown
# Database — Schema Conventions and Migration Rules

## Naming
- Tables: plural snake_case (user_accounts, order_items)
- Columns: singular snake_case (created_at, user_id)
- Indexes: idx_{table}_{columns} (idx_orders_user_id)

## Migrations
- Always reversible (include up and down)
- One logical change per migration
- Never modify a released migration — create a new one
```

### 5. Testing strategy guide

```markdown
# Testing — What and How We Test

## Test pyramid
- Unit: 70% of tests. Pure functions, no I/O.
- Integration: 25%. Database, API calls, multi-module.
- E2E: 5%. Full user flows via Playwright.

## Fixtures
- Database fixtures in tests/fixtures/
- Factory functions in tests/conftest.py
- Never share mutable state between tests
```

### 6. Third-party integration guide

```markdown
# Stripe Integration — Payment Processing

## Environment
- Test mode: sk_test_* keys in .env
- Live mode: secrets manager (never in repo)

## Webhook handling
- Endpoint: POST /webhooks/stripe
- Verify signature before processing
- Idempotent: check event_id before acting
```

### 7. Monitoring and alerting guide

```markdown
# Monitoring — Dashboards and Alerts

## Key dashboards
- grafana.internal/d/api-latency — request latency by endpoint
- grafana.internal/d/error-rates — 5xx rates with deploy markers

## Alert thresholds
- p99 latency > 500ms for 5 minutes → PagerDuty
- Error rate > 1% for 3 minutes → Slack #oncall
```

### 8. Code generation guide

```markdown
# Code Generation — Protobuf and GraphQL

## Protobuf
- .proto files in proto/
- Run `make gen-proto` after changes
- Generated Go code goes to internal/pb/ (gitignored)

## GraphQL
- Schema in schema.graphql
- Run `make gen-gql` after changes
- Generated resolvers go to internal/graph/ (gitignored)
```

### 9. Security practices guide

```markdown
# Security — What We Enforce

## Secret management
- Secrets in AWS Secrets Manager, never in code
- .env for local dev only, always in .gitignore
- Rotate credentials quarterly

## Input validation
- Validate at API boundary (request handlers)
- Sanitize HTML output (XSS prevention)
- Parameterized queries only (SQL injection prevention)
```

### 10. Feature flag guide

```markdown
# Feature Flags — How We Roll Out Changes

## System
- LaunchDarkly SDK in src/flags/
- Flags defined in flags.yaml with owner and expiry

## Lifecycle
1. Create flag in LaunchDarkly dashboard
2. Add to flags.yaml with owner and planned removal date
3. Gate new code behind flag
4. Roll out: 5% → 25% → 50% → 100%
5. Remove flag and dead code path within 2 weeks of 100%
```
