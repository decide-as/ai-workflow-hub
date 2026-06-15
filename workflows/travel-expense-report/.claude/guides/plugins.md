# Plugins — Packaged Extension Bundles

## What it is

Complete, distributable extension packages that bundle skills, agents, hooks, MCP servers, and settings into a single installable unit. Plugins are the heaviest-weight extension mechanism — use them when you need to package and share configurations.

## Where it lives

- `~/.claude/plugins/` — User-installed plugins
- `.claude/plugins/` — Project-specific plugins
- `.claude-plugin/plugin.json` — Makes the current project itself a plugin

## Plugin structure

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json          # Required: manifest with name, version, etc.
├── skills/
│   └── deploy/SKILL.md      # Bundled skills
├── agents/
│   └── reviewer.md          # Custom agent definitions
├── hooks/
│   └── hooks.json           # Event handlers
├── .mcp.json                # MCP server configurations
├── settings.json            # Default settings
└── README.md                # Documentation
```

## Manifest (`plugin.json`)

```json
{
  "name": "my-plugin",
  "description": "What this plugin does",
  "version": "1.0.0",
  "author": "Your Name",
  "homepage": "https://github.com/you/my-plugin",
  "license": "MIT"
}
```

## When to use

- Sharing a complete workflow setup with a team
- Distributing standard configurations across an organization
- Publishing reusable extensions to a marketplace
- Bundling related skills + hooks + MCP servers together

## When NOT to use

- Personal, quick-iteration workflows → use standalone skills
- Single-purpose automation → use hooks directly
- Project-specific rules → use `.claude/rules/`

## Examples

### 1. Django development plugin

```
django-dev/
├── .claude-plugin/plugin.json
├── skills/
│   ├── django-migrate/SKILL.md    # Create and apply migrations
│   ├── django-shell/SKILL.md      # Interactive Django shell queries
│   └── django-test/SKILL.md       # Run tests with coverage
├── hooks/hooks.json               # Auto-format with black after edits
└── settings.json                  # Allow Django management commands
```

### 2. AWS infrastructure plugin

```
aws-infra/
├── .claude-plugin/plugin.json
├── skills/
│   ├── deploy-lambda/SKILL.md     # Deploy Lambda functions
│   ├── check-costs/SKILL.md       # Query AWS Cost Explorer
│   └── tail-logs/SKILL.md         # Stream CloudWatch logs
├── .mcp.json                      # AWS MCP server config
└── settings.json                  # Allow AWS CLI commands
```

### 3. Code quality plugin

```
code-quality/
├── .claude-plugin/plugin.json
├── skills/
│   ├── lint-fix/SKILL.md          # Run all linters and fix issues
│   ├── complexity/SKILL.md        # Analyze cyclomatic complexity
│   └── dead-code/SKILL.md         # Find unused exports and functions
├── hooks/hooks.json               # Post-edit: run formatter
└── settings.json
```

### 4. Docker operations plugin

```
docker-ops/
├── .claude-plugin/plugin.json
├── skills/
│   ├── docker-build/SKILL.md      # Build and tag images
│   ├── docker-debug/SKILL.md      # Inspect running containers
│   └── docker-compose/SKILL.md    # Manage compose services
├── hooks/hooks.json               # Validate Dockerfile on edit
└── settings.json                  # Allow docker commands
```

### 5. Monorepo management plugin

```
monorepo/
├── .claude-plugin/plugin.json
├── skills/
│   ├── affected/SKILL.md          # Find affected packages from changes
│   ├── publish/SKILL.md           # Version and publish packages
│   └── workspace/SKILL.md         # Navigate workspace dependencies
├── agents/
│   └── cross-package.md           # Agent aware of package boundaries
└── settings.json
```

### 6. API testing plugin

```
api-testing/
├── .claude-plugin/plugin.json
├── skills/
│   ├── test-endpoint/SKILL.md     # Test a specific API endpoint
│   ├── load-test/SKILL.md         # Run k6 load tests
│   └── mock-server/SKILL.md       # Generate mock server from OpenAPI
├── .mcp.json                      # Postman/Insomnia MCP server
└── settings.json
```

### 7. Documentation plugin

```
docs-toolkit/
├── .claude-plugin/plugin.json
├── skills/
│   ├── api-docs/SKILL.md          # Generate API docs from code
│   ├── adr/SKILL.md               # Create Architecture Decision Records
│   └── diagram/SKILL.md           # Generate Mermaid diagrams
├── hooks/hooks.json               # Validate markdown links on edit
└── settings.json
```

### 8. CI/CD management plugin

```
ci-cd/
├── .claude-plugin/plugin.json
├── skills/
│   ├── check-pipeline/SKILL.md    # Inspect CI pipeline status
│   ├── retry-job/SKILL.md         # Retry failed CI jobs
│   └── add-workflow/SKILL.md      # Scaffold GitHub Actions workflow
├── .mcp.json                      # GitHub Actions MCP server
└── settings.json
```

### 9. Data pipeline plugin

```
data-pipeline/
├── .claude-plugin/plugin.json
├── skills/
│   ├── run-etl/SKILL.md           # Execute ETL pipeline
│   ├── validate-schema/SKILL.md   # Check data against schema
│   └── profile-data/SKILL.md      # Generate data quality report
├── .mcp.json                      # Database MCP servers
├── hooks/hooks.json               # Validate SQL on edit
└── settings.json
```

### 10. Security compliance plugin

```
security-compliance/
├── .claude-plugin/plugin.json
├── skills/
│   ├── scan-deps/SKILL.md         # Audit dependencies for CVEs
│   ├── check-secrets/SKILL.md     # Scan for hardcoded secrets
│   └── compliance/SKILL.md        # Verify OWASP/SOC2 checklist
├── hooks/hooks.json               # Block commits with secrets
├── agents/
│   └── security-reviewer.md       # Security-focused code reviewer
└── settings.json
```

## Installing plugins

```bash
# From GitHub
claude plugin install github:user/repo

# From local path (development)
claude --plugin-dir ./my-plugin

# From marketplace
claude plugin install plugin-name
```

## Plugin vs standalone

| Need | Use |
|------|-----|
| Quick personal workflow | Standalone skill in `~/.claude/skills/` |
| Team-shared workflow | Skill in `.claude/skills/` (checked into git) |
| Bundled tools + automation | Plugin |
| Cross-org distribution | Plugin with marketplace |
