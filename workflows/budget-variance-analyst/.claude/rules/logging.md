# Logging Rules

## Setup

- Use Python's built-in `logging` module, not `print()` for operational output.
- Configure logging once at the application entry point, not in library modules.
- Use `logging.getLogger(__name__)` in each module for namespaced loggers.

## Log levels

- **DEBUG**: Detailed diagnostic information (request payloads, intermediate state).
- **INFO**: Confirmation that things are working as expected (startup, task completion).
- **WARNING**: Something unexpected happened but the application can continue.
- **ERROR**: A function failed but the application can recover.
- **CRITICAL**: The application cannot continue.

## Best practices

- Include context in log messages: IDs, counts, durations — not just "error occurred".
- Never log secrets, tokens, passwords, or full API keys.
- Use structured logging (key=value pairs) for machine-parseable output when appropriate.
- Log at function boundaries (entry/exit) for long-running or critical operations.
