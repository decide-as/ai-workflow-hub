# Hooks — Event-Driven Automation

## What it is

Shell commands (or HTTP/LLM handlers) that execute automatically when specific events occur during a Claude Code session. Hooks are deterministic — they always run when their event fires, unlike skills which require invocation.

## Where it lives

Configured in settings files under the `hooks` key:

- `~/.claude/settings.json` — Global hooks for all projects
- `.claude/settings.json` — Project hooks, shared via git
- `.claude/settings.local.json` — Local hooks, gitignored

## When to use

- Enforce rules automatically (block edits to protected files)
- Run formatters after every code edit
- Send notifications when Claude is waiting for input
- Validate output before Claude presents it
- Inject context at session start
- Audit tool usage for compliance

## When NOT to use

- Complex multi-step workflows → use Skills
- One-time tasks → just tell Claude directly
- External service integration → use MCP Servers

## Hook events

| Event | Fires when |
|-------|-----------|
| `PreToolUse` | Before a tool executes |
| `PostToolUse` | After a tool completes |
| `Notification` | Claude sends a notification |
| `Stop` | Claude finishes a response turn |
| `SubagentStop` | A subagent completes |

## Hook structure

```json
{
  "hooks": {
    "EventName": [
      {
        "matcher": "ToolName",
        "hooks": [
          {
            "type": "command",
            "command": "shell command here"
          }
        ]
      }
    ]
  }
}
```

## Input/Output

Hooks receive JSON on stdin with event details. They can:
- **Exit 0**: Continue normally
- **Exit 2**: Block the operation (PreToolUse only)
- **Print to stdout**: Message shown to Claude as feedback
- **Print to stderr**: Shown in debug logs

## Examples

### 1. Auto-format Python after edits

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "echo $CLAUDE_TOOL_INPUT | jq -r '.file_path' | grep '\\.py$' && ruff format $(echo $CLAUDE_TOOL_INPUT | jq -r '.file_path') || true"
          }
        ]
      }
    ]
  }
}
```

### 2. Block edits to protected files

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "file=$(cat /dev/stdin | jq -r '.tool_input.file_path // empty'); case \"$file\" in *.lock|*migration*) echo 'BLOCKED: Do not edit lock files or migrations directly' >&1; exit 2;; esac"
          }
        ]
      }
    ]
  }
}
```

### 3. Run tests after code changes

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "file=$(cat /dev/stdin | jq -r '.tool_input.file_path // empty'); echo \"$file\" | grep -q '\\.py$' && pytest tests/ -x -q --tb=short 2>&1 | tail -5 || true"
          }
        ]
      }
    ]
  }
}
```

### 4. Desktop notification when Claude needs input

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "msg=$(cat /dev/stdin | jq -r '.message // \"Claude needs attention\"'); osascript -e \"display notification \\\"$msg\\\" with title \\\"Claude Code\\\"\""
          }
        ]
      }
    ]
  }
}
```

### 5. Prevent committing to main branch

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "input=$(cat /dev/stdin | jq -r '.tool_input.command // empty'); if echo \"$input\" | grep -q 'git commit' && [ \"$(git branch --show-current)\" = 'main' ]; then echo 'BLOCKED: Do not commit directly to main'; exit 2; fi"
          }
        ]
      }
    ]
  }
}
```

### 6. Log all tool usage for audit

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "cat /dev/stdin | jq '{timestamp: now | todate, tool: .tool_name, session: env.CLAUDE_SESSION_ID}' >> ~/.claude/audit.jsonl"
          }
        ]
      }
    ]
  }
}
```

### 7. Enforce max file size on writes

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "content_len=$(cat /dev/stdin | jq -r '.tool_input.content' | wc -c); if [ \"$content_len\" -gt 50000 ]; then echo 'BLOCKED: File content exceeds 50KB limit. Split into smaller files.'; exit 2; fi"
          }
        ]
      }
    ]
  }
}
```

### 8. Auto-add copyright header to new files

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "file=$(cat /dev/stdin | jq -r '.tool_input.file_path // empty'); if echo \"$file\" | grep -qE '\\.(py|ts|js)$' && ! head -1 \"$file\" | grep -q 'Copyright'; then echo \"File $file is missing copyright header — please add one.\"; fi"
          }
        ]
      }
    ]
  }
}
```

### 9. Validate JSON/YAML files after edit

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "file=$(cat /dev/stdin | jq -r '.tool_input.file_path // empty'); case \"$file\" in *.json) python3 -m json.tool \"$file\" > /dev/null 2>&1 || echo \"WARNING: $file contains invalid JSON\";; *.yaml|*.yml) python3 -c \"import yaml; yaml.safe_load(open('$file'))\" 2>&1 || echo \"WARNING: $file contains invalid YAML\";; esac"
          }
        ]
      }
    ]
  }
}
```

### 10. Prevent secrets in code

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "content=$(cat /dev/stdin | jq -r '.tool_input.content // .tool_input.new_string // empty'); if echo \"$content\" | grep -qEi '(sk-[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16}|ghp_[a-zA-Z0-9]{36})'; then echo 'BLOCKED: Detected what appears to be an API key or secret. Use environment variables instead.'; exit 2; fi"
          }
        ]
      }
    ]
  }
}
```
