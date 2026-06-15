# Error Handling

## Most error handling is cargo-culted

Teams wrap code in try/except because "you should handle errors." But they never answer the prerequisite question: what are you protecting against, and what will you do about it? The result is catch blocks that log a message and re-raise, catch blocks that swallow exceptions and return `None`, and catch blocks that catch `Exception` because nobody knows which specific exception the call can raise.

The practical damage: when something does fail, the error message says "An error occurred" with no indication of what went wrong, why, or how to fix it. The traceback points to the catch site, not the cause. And the team adds another try/except around the first one, hoping two layers of vague handling will somehow produce clarity.

Good error handling is not about catching more exceptions. It is about catching the right exceptions, at the right boundaries, with messages that make the problem diagnosable without reading the source code. For how errors propagate across module and process boundaries, see `_a6-error-boundaries.md`.

## Exception hierarchy design

Build your exceptions as a tree rooted in a project-specific base class:

```python
class ProjectError(Exception):
    """Base exception for this project."""

class ConfigError(ProjectError):
    """Invalid or missing configuration."""

class TemplateNotFoundError(ConfigError):
    """Requested template does not exist in the chain."""

class ExternalServiceError(ProjectError):
    """An external dependency (API, database, filesystem) failed."""

class TransientError(ExternalServiceError):
    """Failure is temporary and retryable."""
```

This gives callers a choice: catch `ProjectError` for "anything from this library failed," catch `ConfigError` for "configuration is wrong," or catch `TemplateNotFoundError` for the one specific case they can handle. Never use generic `ValueError` or `RuntimeError` as your primary error type — those leak implementation details and make it impossible for callers to react differently to different failure modes.

The common objection: "that's too many exception classes." You'll typically have 5-10. That's fewer than the number of HTTP status codes you already use, and the cognitive cost is the same — a name that tells you what went wrong.

## The "catch at boundaries" principle

Most code should not catch exceptions at all. Let them propagate. There are exactly three places where catching makes sense:

1. **Application entry points** (CLI handlers, HTTP endpoints, task runners): catch your base exception, format it for the user, log the full traceback, return an appropriate exit code or status.
2. **Integration boundaries** (calling an external API, reading a file, running a subprocess): catch the library's specific exceptions and translate them into your domain exceptions. `except requests.ConnectionError` becomes `raise ExternalServiceError("API unreachable") from err`.
3. **Optional operations** (badge generation, analytics, telemetry): catch, log a warning, continue. But only when the operation is genuinely optional — document which subsystems can degrade.

Everywhere else, let the exception fly. A try/except in the middle of business logic almost always means the code is doing error handling that belongs somewhere else.

## Error message quality

A good error message answers three questions in one read: **what** failed, **why** it failed, and **how to fix it**.

```python
# This tells you nothing
raise ValueError("invalid input")

# This is diagnosable without reading source code
raise TemplateNotFoundError(
    f"Template '{name}' not found in chain {chain}. "
    f"Searched: {', '.join(searched_paths)}. "
    f"Run 'cp list' to see available templates."
)
```

The "how to fix" part is the one engineers skip most often, and it's the part users need most. When you know what the user should do, say it. When you don't, at least say what state the system is in so they can diagnose it themselves.

When re-raising, always use `raise ... from err`. Without it, Python prints both tracebacks but loses the causal link, making it harder to trace the actual failure chain.

## Fail-fast validation

Validate inputs at function entry, before any work is done. Do not let bad data propagate through three layers of business logic before something finally throws a `KeyError` with no context.

```python
def scaffold(metadata: ProjectMetadata, output_dir: Path) -> Path:
    if not output_dir.parent.exists():
        raise FileNotFoundError(
            f"Parent directory does not exist: {output_dir.parent}"
        )
    if not metadata.name:
        raise MetadataError("Agent name is required for scaffolding")
    # All inputs validated — proceed with the real work
```

Guard clauses at the top of a function serve two purposes: they reject invalid state before it causes confusing downstream errors, and they document the function's preconditions for anyone reading the code.

The anti-pattern: returning `None` on bad input and forcing every caller to check. This spreads error handling across the codebase instead of concentrating it at the source. Raise on bad input. Let the caller decide whether to catch it.

## Recovery and cleanup

When a multi-step operation fails partway through, the system is in an inconsistent state. Two patterns handle this:

**Context managers** for resource cleanup:

```python
with tempfile.TemporaryDirectory() as tmp:
    render_templates(tmp)
    shutil.copytree(tmp, target)  # atomic-ish move
```

**Explicit rollback** for filesystem mutations:

```python
try:
    create_directory(target)
    render_templates(target)
    copy_rules(target)
except Exception:
    shutil.rmtree(target, ignore_errors=True)
    raise
```

The key discipline: decide before you start coding a multi-step operation what the rollback strategy is. If you cannot articulate what cleanup looks like, the operation needs a different structure.

## Retry strategy

Only retry errors that are transient. Network timeouts, rate limits, temporary file locks — these are retryable. Validation errors, permission errors, missing configuration — these are permanent. Retrying permanent errors is a bug that makes failures take longer to surface.

```python
def retry(fn, max_attempts=3, base_delay=1.0, backoff_factor=2.0):
    for attempt in range(max_attempts):
        try:
            return fn()
        except TransientError:
            if attempt == max_attempts - 1:
                raise
            delay = base_delay * (backoff_factor ** attempt)
            time.sleep(delay + random.uniform(0, delay * 0.1))
```

Exponential backoff with jitter prevents thundering herds when multiple clients retry against the same failing service. The jitter is not optional — without it, all clients retry at the same moment, recreating the overload condition.

Set a maximum retry count. Infinite retries mask real problems and make debugging impossible. Three retries with exponential backoff covers most transient failures. If three attempts over ~7 seconds don't work, the problem is not transient.

## Anti-patterns

**Catch-log-reraise**: `except SomeError as e: logger.error(e); raise` — this logs the same error at every layer it passes through, producing 5 log entries for one failure. Log at the boundary, not at every intermediate step.

**Pokemon exception handling**: `except Exception: pass` — catches everything, tells you nothing, hides real bugs. Named after "gotta catch 'em all." Every time you're tempted, ask: what specific exception am I expecting here, and what will I do about it?

**Returning error codes instead of raising**: `return (False, "something failed")` — this forces every caller to check a tuple, is easy to forget, and circumvents Python's entire exception mechanism. Raise exceptions. That's what they're for.

**Overly specific handling**: catching 15 different exception types with identical handling in each block. If the recovery action is the same, catch the common base class. The hierarchy exists for this purpose.
