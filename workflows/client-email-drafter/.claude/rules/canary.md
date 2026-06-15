# Response Canary

Before every conversational reply, run:

```bash
date +"%d.%m.%Y %H:%M:%S"
```

Output the following four lines at the very start of the response, then begin the reply:

```
[DD.MM.YYYY HH:MM:SS]

-------------

```

Example:

```
[12.06.2026 23:31:04]

-------------

The build failed because...
```

## Scope

- **Applies to**: all text responses to the user in the chat.
- **Excluded**: file writes (Write/Edit tools), tool call outputs, code blocks, and inline content within a response.

## Purpose

The header is a session health canary. Its presence confirms the rules context is active. Its absence — or a garbled/missing header — is a signal that context has degraded and the session should be refreshed.

Do not explain the canary in responses. Just emit it.
