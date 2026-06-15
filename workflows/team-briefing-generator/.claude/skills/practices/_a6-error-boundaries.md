# Error Boundaries

## Errors don't respect your module boundaries — but they should

Inside a single module, error handling is straightforward: validate inputs, raise on failure, catch at the top. The real complexity starts when errors cross boundaries — between modules, between services, between processes. At each boundary, the error changes audience: what was a useful diagnostic for the developer of module A is meaningless noise for the developer of module B, and actively dangerous for an end user.

The most common failure mode is not "unhandled exception crashes the program." It's "an exception from a low-level dependency leaks through three layers of abstraction, arrives at the user with a message about a dict key they've never heard of, and nobody can tell from the traceback which high-level operation actually failed." The second most common: an error in an optional subsystem brings down the entire application because nobody decided which components are allowed to fail.

Error boundary design answers two questions: where do you transform errors, and where do you let them propagate unchanged? For foundational exception hierarchy design and error message quality, see `_a1-error-handling.md`.

## Exception hierarchy as boundary contract

Your exception hierarchy is not just a convenience for catch blocks — it's the contract between your module and its callers. When a module exposes `ConfigError`, `ValidationError`, and `ExternalServiceError`, it's promising that these are the only failure modes callers need to handle.

```python
class ProjectError(Exception):
    """Base — catch this if you want 'anything from this library.'"""

class ConfigError(ProjectError):
    """The configuration is invalid or missing."""

class ValidationError(ProjectError):
    """User-provided input failed validation."""

class ExternalServiceError(ProjectError):
    """A dependency outside this process failed."""

class TransientError(ExternalServiceError):
    """Failure is temporary — safe to retry."""

class PermanentError(ExternalServiceError):
    """Failure is permanent — do not retry."""
```

The `TransientError` / `PermanentError` split is the most operationally important distinction in the entire hierarchy. Callers cannot make correct retry decisions without it, and they should never have to guess which errors are retryable by examining the message string.

## Error transformation at boundaries

The principle: let errors bubble freely within a module, but transform them when they cross a module boundary. The caller should never see your implementation details.

**Within a module** — don't catch, don't wrap, let the traceback tell the full story:

```python
def _resolve_template_chain(chain):
    # If this raises KeyError, that's a bug in this module.
    # Let it propagate with the full traceback.
    return [TEMPLATES[name] for name in chain]
```

**At a module boundary** — translate to your domain exception:

```python
def load_config(path: Path) -> dict:
    try:
        return yaml.safe_load(path.read_text())
    except FileNotFoundError:
        raise ConfigError(f"Config file not found: {path}") from None
    except yaml.YAMLError as exc:
        raise ConfigError(f"Invalid YAML in {path}: {exc}") from exc
```

**At a process boundary** (CLI, HTTP handler, task runner) — format for the end user:

```python
def main():
    try:
        run_scaffold(args)
    except ValidationError as exc:
        click.echo(f"[!!] {exc}", err=True)
        raise SystemExit(1)
    except ProjectError as exc:
        click.echo(f"[!!] Internal error: {exc}", err=True)
        logger.exception("Unhandled project error")
        raise SystemExit(2)
```

The anti-pattern is catching and wrapping at every layer: module A wraps in `AError`, module B catches `AError` and wraps in `BError`, the CLI catches `BError` and wraps in `CLIError`. Now the traceback is four exceptions deep and the original context is buried. Wrap once, at the boundary that changes the audience.

## Transient vs permanent failures

This distinction drives every retry, circuit breaker, and degradation decision. Get it wrong and you either retry forever against a permanently broken service or give up immediately on a network blip.

**Transient**: network timeouts, HTTP 429/503, temporary file locks, connection pool exhaustion. These resolve on their own or with backoff.

**Permanent**: authentication failures, validation errors, missing required configuration, HTTP 400/404. Retrying these wastes time and can cause harm (rate limiting, account lockout).

**Ambiguous**: HTTP 500 from a dependency. It could be a transient overload or a permanent bug in their code. Default to treating it as transient with a low retry count (2-3 attempts). If it persists past retries, escalate as permanent.

Encode this classification in your exception hierarchy, not in retry logic. The module that raises the error knows whether it's transient. The module that catches it shouldn't have to guess.

## Retry and circuit breaker

Retry handles individual transient failures. Circuit breakers handle systemic failures — when a dependency is down and every call will fail, stop calling it instead of burning through retry budgets on every request.

```python
class CircuitBreaker:
    def __init__(self, failure_threshold=5, reset_timeout=30):
        self.failures = 0
        self.threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.last_failure = 0
        self.state = "closed"  # closed | open | half-open

    def call(self, fn):
        if self.state == "open":
            if time.time() - self.last_failure > self.reset_timeout:
                self.state = "half-open"
            else:
                raise ExternalServiceError("Circuit open — dependency unavailable")
        try:
            result = fn()
            self._on_success()
            return result
        except TransientError:
            self._on_failure()
            raise

    def _on_success(self):
        self.failures = 0
        self.state = "closed"

    def _on_failure(self):
        self.failures += 1
        self.last_failure = time.time()
        if self.failures >= self.threshold:
            self.state = "open"
```

The circuit breaker belongs at the integration boundary — the module that calls the external service. Internal module boundaries don't need circuit breakers because internal failures aren't transient in the same way.

## Graceful degradation

Not every component failure should crash the application. The decision of what can degrade must be made explicitly and documented, not discovered during an outage.

**Critical** (must succeed or the operation is meaningless): template rendering, metadata validation, file writing. If these fail, abort and roll back.

**Optional** (failure is acceptable with reduced functionality): badge generation, analytics, telemetry, README rendering. If these fail, log a warning and continue.

```python
def scaffold(metadata, output_dir):
    render_templates(output_dir)        # critical — raise on failure
    copy_rules(output_dir)              # critical — raise on failure

    try:
        generate_badges(output_dir)     # optional — degrade on failure
    except ProjectError:
        logger.warning("Badge generation failed — skipping")

    try:
        send_analytics(metadata)        # optional — degrade on failure
    except Exception:
        logger.debug("Analytics unavailable")
```

The trap: treating everything as optional to avoid crashes. If template rendering silently fails and you continue, the user gets a broken project with no error message. Graceful degradation only works when you've drawn a clear line between "the operation succeeded with reduced features" and "the operation failed."

## Anti-patterns

**Catch-and-continue everywhere**: wrapping every function call in try/except and continuing regardless. This turns a single root cause into dozens of downstream failures, all with misleading error messages. Let non-optional operations fail.

**Leaking abstractions through exceptions**: `raise ValueError(f"key {k} not in dict")` from a module that's supposed to provide a clean config interface. The caller now knows your config is stored in a dict. Transform to domain exceptions at the boundary.

**Logging at every layer**: catching an exception, logging it, and re-raising at three different module boundaries produces three log entries for one failure. Log once, at the outermost boundary that handles the error.

**Retrying permanent errors**: `except Exception: retry()` — this retries validation errors, permission errors, and programming bugs. Only retry errors you have explicitly classified as transient.
