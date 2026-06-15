# Skills

## Overview

Converts raw meeting transcripts into structured summaries with decisions and action items

## Available Skills

<!-- Add skills as they are implemented. Each skill should have:
     - Name and description
     - Input/output formats
     - Brief usage example
-->

## Artifact Types

Skills produce artifacts containing one or more typed parts:

| Type | Fields | Use |
|------|--------|-----|
| Text | `type: "text"`, `text`, `mimeType?` | Plain text results, summaries, reports |
| Data | `type: "data"`, `data` (JSON object) | Structured results for machine consumption |
| File | `type: "file"`, `uri` or `bytes`, `mimeType` | Binary outputs, generated files |

### Examples

**Text artifact:**
```json
{ "parts": [{ "type": "text", "text": "Analysis complete: 3 issues found." }] }
```

**Structured data artifact:**
```json
{ "parts": [{ "type": "data", "data": { "issues": 3, "severity": "medium" } }] }
```

**Combined (human + machine readable):**
```json
{
  "parts": [
    { "type": "text", "text": "Found 3 issues." },
    { "type": "data", "data": { "issues": [...] } }
  ]
}
```

## Commands

<!-- List any custom /commands available in .claude/commands/ -->
<!-- Example:
- `/deploy` — Deploy the agent to production
- `/status` — Check agent health
-->

## Configuration

- See `project-meta.yaml` for full project metadata
