# Output Styles — Custom Presentation Formats

## What it is

Markdown files that control how Claude formats its responses without changing its behavior. Output styles affect presentation only — the same analysis, the same code, just displayed differently.

## Where it lives

- `.claude/output-styles/style-name.md` — Project-specific styles
- `~/.claude/output-styles/style-name.md` — Personal styles across all projects

## How to use

- `/output-style` — List available styles and switch between them
- `/output-style minimal` — Switch to a specific style by name

## When to use

- You prefer structured tables over prose for technical analysis
- You want ultra-concise responses during rapid iteration
- You need verbose explanations for documentation or teaching
- Your team wants consistent formatting across all sessions
- You want different styles for different phases of work

## When NOT to use

- You want to change what Claude does → use CLAUDE.md, Rules, or Skills
- You want to restrict tools → use Settings or Custom Agents
- You want one-time formatting → just ask in the prompt

## Key distinction

| Mechanism | Changes behavior? | Changes formatting? |
|-----------|-------------------|-------------------|
| CLAUDE.md | Yes | Sometimes |
| Rules | Yes | Sometimes |
| Skills | Yes | Sometimes |
| Output Styles | No | Yes |

## Style file format

```markdown
---
name: minimal
description: Ultra-concise responses for rapid iteration
---

Formatting rules:
- Maximum 3 sentences per response unless code is involved
- No preamble or summary — start with the answer or action
- Use inline code for file paths and function names
- No bullet lists for fewer than 3 items — use a sentence
- Code blocks only — no prose explanations of code
```

## Examples

### 1. Minimal style (rapid iteration)

```markdown
---
name: minimal
description: Terse responses for experienced developers
---

Response rules:
- Lead with the answer, never the reasoning
- No greetings, no filler, no "certainly" or "of course"
- Maximum 3 sentences outside of code blocks
- Skip explanations unless the logic is non-obvious
- If the change is obvious from the diff, say nothing
```

### 2. Verbose style (learning/documentation)

```markdown
---
name: verbose
description: Detailed explanations for learning and documentation
---

Response rules:
- Explain the reasoning before showing the solution
- Define technical terms on first use
- Include "why" for every design decision
- Show alternative approaches that were considered and why they were rejected
- Add inline comments in code blocks explaining non-obvious lines
- End with a summary of what changed and what to verify
```

### 3. Structured table style

```markdown
---
name: structured
description: Use tables and structured formats for all analysis
---

Response rules:
- Present findings as tables whenever possible
- Use this format for comparisons: | Option | Pros | Cons | Recommendation |
- Use this format for code changes: | File | Change | Reason |
- Use this format for issues: | Severity | Location | Description | Fix |
- Reserve prose for context that doesn't fit tables
```

### 4. Code-heavy style

```markdown
---
name: code-heavy
description: Maximize code, minimize prose
---

Response rules:
- Show the code first, explain second
- Use complete, runnable examples — no pseudocode
- Include import statements and setup
- Add comments directly in code instead of separate explanations
- When asked "how do I X", respond with code, not instructions
```

### 5. Diff-focused style

```markdown
---
name: diff-focused
description: Show changes as diffs for easy review
---

Response rules:
- When modifying code, show the diff format (- old / + new) before making the edit
- Group related changes together
- Annotate each diff hunk with the reason for the change
- After all changes, list files modified as a summary table
```

### 6. Checklist style

```markdown
---
name: checklist
description: Action items as checklists for task tracking
---

Response rules:
- Present all recommendations as checkbox lists
- Group items by priority: Critical, Important, Nice-to-have
- Include estimated effort next to each item (small/medium/large)
- End with a "next steps" checklist
```

### 7. Socratic style (code review)

```markdown
---
name: socratic
description: Ask questions instead of prescribing fixes
---

Response rules:
- For each issue found, frame it as a question
- Example: "What happens if `user` is null here?" instead of "Add a null check"
- Only provide the direct fix if explicitly asked
- Group questions by severity
- End with: "What are your thoughts on these?"
```

### 8. Executive summary style

```markdown
---
name: executive
description: High-level summaries with optional drill-down
---

Response rules:
- Start with a 1-2 sentence executive summary
- Follow with key metrics or findings as bullet points (max 5)
- Use collapsible sections (<details>) for technical details
- End with a clear recommendation and next action
```

### 9. Markdown documentation style

```markdown
---
name: docs
description: Output formatted for direct inclusion in documentation
---

Response rules:
- Use proper heading hierarchy (##, ###)
- Include code blocks with language annotations
- Add front matter when generating doc files
- Use admonition-style callouts: > **Note:** and > **Warning:**
- Write in third person, present tense
- Include cross-references as [links](path)
```

### 10. Debug trace style

```markdown
---
name: debug-trace
description: Show reasoning chain for debugging sessions
---

Response rules:
- Number each investigation step
- Format: Step N: [hypothesis] → [action] → [finding]
- Show what was checked and what was ruled out
- Mark dead ends explicitly: "❌ Ruled out: [reason]"
- Highlight the root cause with: "✅ Root cause: [explanation]"
- End with the fix and verification steps
```
