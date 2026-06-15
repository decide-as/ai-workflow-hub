# Settings — Permissions, Configuration, and Modes

## What it is

JSON configuration files that control Claude Code's behavior: which tools are allowed, how the sandbox works, which models to use, and more. Settings merge across multiple scopes with a strict precedence hierarchy.

## Where it lives (precedence order, highest first)

1. **Managed** — `/Library/Application Support/ClaudeCode/managed-settings.json` (macOS) — IT-enforced, cannot be overridden
2. **Command line** — `--allowedTools`, `--disallowedTools` flags
3. **Local project** — `.claude/settings.local.json` — Personal, gitignored
4. **Shared project** — `.claude/settings.json` — Team-shared, in git
5. **User global** — `~/.claude/settings.json` — Personal, all projects

Array settings (like `permissions.allow`) **merge** across scopes. Object settings at higher scopes **override** lower ones.

## When to use

- Control which tools Claude can use without prompting
- Set up project-wide permission policies
- Configure sandbox restrictions
- Define environment variables for all tool executions
- Set model preferences

## Key settings categories

### Permissions

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Glob",
      "Grep",
      "Bash(pytest *)",
      "Bash(git *)",
      "Bash(ruff *)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(curl *)"
    ]
  }
}
```

### Permission modes

- `default` — Ask for each unrecognized tool use
- `plan` — Read-only mode, no edits or execution
- `acceptEdits` — Auto-approve file edits
- `bypassPermissions` — Skip all checks (dangerous, isolated environments only)

## Examples

### 1. Python project permissions

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Edit",
      "Write",
      "Glob",
      "Grep",
      "Bash(python *)",
      "Bash(pytest *)",
      "Bash(ruff *)",
      "Bash(pip install *)",
      "Bash(git *)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(pip install --user *)"
    ]
  }
}
```

### 2. Node.js project permissions

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Edit",
      "Write",
      "Glob",
      "Grep",
      "Bash(npm *)",
      "Bash(npx *)",
      "Bash(node *)",
      "Bash(bun *)",
      "Bash(git *)",
      "Bash(tsc *)",
      "Bash(eslint *)"
    ]
  }
}
```

### 3. Read-only exploration (safe for unfamiliar codebases)

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Glob",
      "Grep"
    ],
    "deny": [
      "Edit",
      "Write",
      "Bash"
    ]
  }
}
```

### 4. Allow specific MCP tools only

```json
{
  "permissions": {
    "allow": [
      "mcp__postgres__query",
      "mcp__github__search_issues",
      "mcp__github__get_issue"
    ],
    "deny": [
      "mcp__postgres__execute",
      "mcp__github__create_issue"
    ]
  }
}
```

### 5. Environment variables for tools

```json
{
  "env": {
    "PYTHONDONTWRITEBYTECODE": "1",
    "NODE_ENV": "development",
    "DATABASE_URL": "postgresql://localhost:5432/devdb",
    "LOG_LEVEL": "debug"
  }
}
```

### 6. Sandbox configuration

```json
{
  "sandbox": {
    "filesystem": {
      "readPaths": ["/Users/me/projects", "/usr/local/lib"],
      "writePaths": ["/Users/me/projects/current"]
    },
    "network": {
      "allowedDomains": ["api.github.com", "registry.npmjs.org", "pypi.org"]
    }
  }
}
```

### 7. Model preferences

```json
{
  "model": "claude-sonnet-4-6",
  "alwaysThinkingEnabled": true
}
```

### 8. Local overrides (`.claude/settings.local.json`)

Use this for personal preferences that shouldn't be committed:

```json
{
  "permissions": {
    "allow": [
      "Bash(docker *)",
      "Bash(kubectl *)"
    ]
  },
  "env": {
    "AWS_PROFILE": "my-dev-profile"
  }
}
```

### 9. Organization-managed settings (IT-enforced)

```json
{
  "permissions": {
    "deny": ["Bash(curl *)", "Bash(wget *)"]
  },
  "disableBypassPermissionsMode": true,
  "allowManagedPermissionRulesOnly": false,
  "allowManagedHooksOnly": false,
  "sandbox": {
    "network": {
      "allowedDomains": ["*.internal.company.com", "github.com"],
      "allowManagedDomainsOnly": true
    }
  }
}
```

### 10. Full project settings example

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Edit",
      "Write",
      "Glob",
      "Grep",
      "Bash(python *)",
      "Bash(pytest *)",
      "Bash(ruff *)",
      "Bash(git *)",
      "Bash(make *)",
      "Bash(docker compose *)"
    ],
    "deny": [
      "Bash(rm -rf /)",
      "Bash(git push --force *)"
    ]
  },
  "env": {
    "PYTHONDONTWRITEBYTECODE": "1",
    "PYTHONPATH": "."
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "file=$(cat /dev/stdin | jq -r '.tool_input.file_path // empty'); echo \"$file\" | grep -q '\\.py$' && ruff format \"$file\" 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

## Permission pattern syntax

| Pattern | Matches |
|---------|---------|
| `Bash(git *)` | Any bash command starting with `git` |
| `Bash(npm run test *)` | Spaces are literal — matches `npm run test` |
| `Read` | All file reads |
| `WebFetch(domain:example.com)` | Fetch from specific domain |
| `mcp__server__tool` | Specific MCP tool |

## Deny > Allow > Ask

When evaluating permissions:
1. If any **deny** rule matches → blocked
2. If any **allow** rule matches → auto-approved
3. Otherwise → user is prompted (ask mode)
