# Keybindings — Keyboard Shortcut Customization

## What it is

A JSON configuration file that maps keystrokes to actions in the Claude Code CLI interface. Allows customizing how you interact with Claude in the terminal.

## Where it lives

`~/.claude/keybindings.json` — Single global file, applies to all projects.

Changes are auto-detected without restarting Claude.

## When to use

- Remap default shortcuts that conflict with your terminal/multiplexer
- Add chord bindings for common actions
- Accommodate different keyboard layouts
- Set up Vim-style or Emacs-style navigation

## When NOT to use

- Automating Claude behavior → use Hooks
- Project-specific shortcuts → not supported (keybindings are global)

## Structure

```json
[
  {
    "keys": "keystroke",
    "action": "namespace:action",
    "context": "ContextName"
  }
]
```

## Reserved keys (cannot be rebound)

- `Ctrl+C` — Interrupt (hardcoded)
- `Ctrl+D` — Exit (hardcoded)

## Key syntax

- Modifiers: `ctrl`, `alt`, `shift`, `meta`
- Chords: `ctrl+k ctrl+s` (press first combo, release, press second)
- Special keys: `escape`, `enter`, `tab`, `space`, `up`, `down`, `left`, `right`
- Uppercase implies shift: `K` = `shift+k`

## Contexts

| Context | Where it applies |
|---------|-----------------|
| `Global` | Everywhere |
| `Chat` | Text input area |
| `Autocomplete` | Suggestion menu |
| `Confirmation` | Permission dialogs |
| `Settings` | Settings menu |

## Actions

| Action | What it does |
|--------|-------------|
| `app:interrupt` | Stop current operation |
| `app:exit` | Quit Claude Code |
| `app:toggleTodos` | Show/hide task list |
| `chat:submit` | Send message |
| `chat:cancel` | Cancel current input |
| `chat:cycleMode` | Switch between modes |
| `chat:modelPicker` | Open model selector |
| `history:search` | Search conversation history |
| `history:previous` | Previous history item |
| `history:next` | Next history item |
| `autocomplete:accept` | Accept suggestion |
| `autocomplete:dismiss` | Dismiss suggestions |
| `confirmation:yes` | Approve permission |
| `confirmation:no` | Deny permission |

## Examples

### 1. Submit with Cmd+Enter instead of Enter

```json
[
  { "keys": "meta+enter", "action": "chat:submit", "context": "Chat" },
  { "keys": "enter", "action": null, "context": "Chat" }
]
```

### 2. Vim-style navigation in autocomplete

```json
[
  { "keys": "ctrl+j", "action": "autocomplete:next", "context": "Autocomplete" },
  { "keys": "ctrl+k", "action": "autocomplete:previous", "context": "Autocomplete" },
  { "keys": "ctrl+l", "action": "autocomplete:accept", "context": "Autocomplete" }
]
```

### 3. Avoid tmux Ctrl+B conflict

```json
[
  { "keys": "ctrl+b", "action": null, "context": "Global" },
  { "keys": "alt+b", "action": "history:previous", "context": "Chat" }
]
```

### 4. Quick model switching chord

```json
[
  { "keys": "ctrl+k ctrl+m", "action": "chat:modelPicker", "context": "Chat" }
]
```

### 5. Escape to dismiss autocomplete

```json
[
  { "keys": "escape", "action": "autocomplete:dismiss", "context": "Autocomplete" }
]
```

### 6. Fast approval shortcuts

```json
[
  { "keys": "y", "action": "confirmation:yes", "context": "Confirmation" },
  { "keys": "n", "action": "confirmation:no", "context": "Confirmation" }
]
```

### 7. Chord for toggling task view

```json
[
  { "keys": "ctrl+k ctrl+t", "action": "app:toggleTodos", "context": "Global" }
]
```

### 8. History navigation with arrow keys

```json
[
  { "keys": "alt+up", "action": "history:previous", "context": "Chat" },
  { "keys": "alt+down", "action": "history:next", "context": "Chat" }
]
```

### 9. Cancel input with Ctrl+U (shell-style)

```json
[
  { "keys": "ctrl+u", "action": "chat:cancel", "context": "Chat" }
]
```

### 10. Full ergonomic setup

```json
[
  { "keys": "meta+enter", "action": "chat:submit", "context": "Chat" },
  { "keys": "ctrl+j", "action": "autocomplete:next", "context": "Autocomplete" },
  { "keys": "ctrl+k", "action": "autocomplete:previous", "context": "Autocomplete" },
  { "keys": "tab", "action": "autocomplete:accept", "context": "Autocomplete" },
  { "keys": "escape", "action": "autocomplete:dismiss", "context": "Autocomplete" },
  { "keys": "alt+up", "action": "history:previous", "context": "Chat" },
  { "keys": "alt+down", "action": "history:next", "context": "Chat" },
  { "keys": "ctrl+k ctrl+m", "action": "chat:modelPicker", "context": "Chat" },
  { "keys": "y", "action": "confirmation:yes", "context": "Confirmation" },
  { "keys": "n", "action": "confirmation:no", "context": "Confirmation" }
]
```
