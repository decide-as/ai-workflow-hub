# MCP Servers — External Tool Integration

## What it is

Model Context Protocol (MCP) servers connect Claude Code to external tools, APIs, databases, and services. They expose "tools" that Claude can call, extending its capabilities beyond the built-in toolset.

## Where it lives

- `~/.claude.json` — Personal MCP servers (all projects)
- `.mcp.json` — Project-scoped servers (shared via git)
- Managed settings — Organization-enforced servers

## Transport types

- **Stdio**: Local process that communicates via stdin/stdout (most common)
- **HTTP**: Remote server with HTTP endpoint (for cloud services)
- **SSE**: Server-Sent Events (legacy, being deprecated)

## When to use

- Query databases directly from Claude conversations
- Interact with external APIs (GitHub, Jira, Slack, etc.)
- Automate browser testing (Playwright)
- Access cloud storage or file systems
- Integrate with monitoring/observability tools

## When NOT to use

- Simple shell commands → use Bash tool directly
- File reading/editing → use built-in Read/Edit tools
- One-off API calls → use `curl` via Bash

## Configuration format

```json
{
  "mcpServers": {
    "server-name": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-package"],
      "env": {
        "API_KEY": "..."
      }
    }
  }
}
```

## Examples

### 1. PostgreSQL database access

```json
{
  "mcpServers": {
    "postgres": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://user:pass@localhost:5432/mydb"
      }
    }
  }
}
```

Use case: Let Claude query your database to debug issues, verify migrations, or check data integrity without leaving the conversation.

### 2. GitHub integration

```json
{
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
      }
    }
  }
}
```

Use case: Search issues, read PR comments, list repository contents, create issues — all from within Claude.

### 3. Filesystem access (sandboxed)

```json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y", "@modelcontextprotocol/server-filesystem",
        "/Users/me/Documents",
        "/Users/me/Downloads"
      ]
    }
  }
}
```

Use case: Give Claude access to directories outside the project (documents, downloads) with explicit path allowlisting.

### 4. Slack messaging

```json
{
  "mcpServers": {
    "slack": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-...",
        "SLACK_TEAM_ID": "T0123456789"
      }
    }
  }
}
```

Use case: Read channel messages for context, post status updates, search conversations for relevant discussions.

### 5. Playwright browser automation

```json
{
  "mcpServers": {
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-playwright"]
    }
  }
}
```

Use case: Navigate web pages, take screenshots, fill forms, run end-to-end tests interactively.

### 6. Memory / persistent knowledge base

```json
{
  "mcpServers": {
    "memory": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "env": {
        "MEMORY_FILE": "/Users/me/.claude/memory.json"
      }
    }
  }
}
```

Use case: Store and retrieve facts, preferences, and context that persist across sessions using a knowledge graph.

### 7. Sentry error tracking

```json
{
  "mcpServers": {
    "sentry": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sentry"],
      "env": {
        "SENTRY_AUTH_TOKEN": "sntrys_...",
        "SENTRY_ORG": "my-org"
      }
    }
  }
}
```

Use case: Pull error details, stack traces, and frequency data directly into debugging conversations.

### 8. Google Drive / Docs

```json
{
  "mcpServers": {
    "gdrive": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-gdrive"],
      "env": {
        "GOOGLE_CLIENT_ID": "...",
        "GOOGLE_CLIENT_SECRET": "..."
      }
    }
  }
}
```

Use case: Search and read Google Docs, Sheets, and Drive files for requirements, specifications, or data.

### 9. Linear issue tracker

```json
{
  "mcpServers": {
    "linear": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-linear"],
      "env": {
        "LINEAR_API_KEY": "lin_api_..."
      }
    }
  }
}
```

Use case: Read issue details, create tasks, update status, and link PRs to issues from within Claude.

### 10. SQLite for local data

```json
{
  "mcpServers": {
    "sqlite": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite", "--db-path", "./data/app.db"]
    }
  }
}
```

Use case: Query local SQLite databases for debugging, data exploration, or testing without installing database tools.

## Permission control

Control which MCP tools Claude can use via settings:

```json
{
  "permissions": {
    "allow": ["mcp__postgres__query"],
    "deny": ["mcp__postgres__execute"]
  }
}
```

This allows read queries but blocks write operations — useful for production database access.
