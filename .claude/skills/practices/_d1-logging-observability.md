# Logging and Observability

## Library vs application logging: the fundamental contract

Libraries must never configure the logging system. No `basicConfig()`, no `addHandler()`, no `setLevel()` calls at module level. A library that does this corrupts the application's log configuration — whichever library loads first wins, and the application developer has no recourse short of manually removing handlers.

The correct library pattern:

```python
import logging
logger = logging.getLogger(__name__)  # that's it — nothing else
```

The application configures handlers, formatters, and levels. The library simply emits records. This is the contract. Violating it in a library you publish is a bug, not a style choice.

## The DEBUG trap

"Log everything at DEBUG and filter in production" sounds reasonable and is deeply wrong. It produces a firehose that is unusable for diagnosis and costs real money in storage and I/O.

DEBUG should be rare and surgical: "entering this branch because condition X was true", "cache miss for key Y, fetching from database". Not: "starting function Z", "about to call helper function", "helper function returned".

A rule of thumb: if DEBUG is enabled on a busy service and your log volume increases by more than 10x, your DEBUG statements are noise, not signal. A skilled engineer should be able to diagnose any production issue without ever enabling DEBUG on a live service. DEBUG is for local development investigation, not a production fallback.

## Log sampling for high-volume services

In a service handling 10,000 requests per second, logging every INFO event means writing 10,000 records per second. This is often wrong on two levels: the volume is expensive, and the signal is buried.

A practical sampling policy:
- **Errors**: 100% — every error is signal, cost is justified
- **Warnings**: 10–25% with rate limiting (same warning class, max once per minute)
- **Info**: 1% or structured summaries — "processed 500 jobs, 3 failures, median 12ms"
- **Debug**: never in production

Implement sampling at the handler or filter level, not by wrapping every log call in `if random.random() < 0.01`.

## Structured vs human-readable: pick the right format per environment

Human-readable format in development:

```
2026-03-18 14:23:01 INFO  scaffold: Created target directory /tmp/my-agent
```

Structured JSON in production:

```json
{"ts": "2026-03-18T14:23:01Z", "level": "INFO", "logger": "code_practices.scaffold", "msg": "Created target directory", "path": "/tmp/my-agent", "duration_ms": 14}
```

These are different formats for different consumers. A developer reading a terminal wants the human form. A log aggregator (Datadog, Loki, CloudWatch) needs structured data to index, filter, and alert on fields. Using the same format for both is a compromise that serves neither well.

Never format context by interpolating strings into the message field — put structured data in fields:

```python
# wrong — the path is buried in a string, unsearchable
logger.info(f"Created target directory {path}")

# right — the path is a queryable field
logger.info("Created target directory", extra={"path": str(path)})
```

## Logger hierarchy: the underused power feature

`logging.getLogger("code_practices.scaffold")` is a child of `logging.getLogger("code_practices")`, which is a child of the root logger. Log records propagate up the hierarchy until they hit a logger with a handler.

This enables per-module level control without touching application code:

```python
# Silence a chatty third-party library
logging.getLogger("urllib3").setLevel(logging.WARNING)

# Enable debug for one noisy module during an investigation
logging.getLogger("code_practices.rules_manager").setLevel(logging.DEBUG)
```

If you name your loggers correctly (always `__name__`, never hardcoded strings), you get this for free. If your library uses `logging.getLogger("mylib")` as a flat namespace, you lose granularity.

## Rate limiting repeated log messages

When a misconfiguration causes the same error on every request, you get millions of identical log lines. They are not millions of times more useful than one. They flood log aggregators, trigger false-positive alert volume thresholds, and make it harder to see other errors.

Implement a `DedupFilter` or use a counter-based approach:

```python
class RateLimitFilter(logging.Filter):
    def __init__(self, rate: int = 1, per: float = 60.0):
        self._counts: dict[str, tuple[int, float]] = {}
        self._rate = rate
        self._per = per

    def filter(self, record: logging.LogRecord) -> bool:
        key = (record.name, record.getMessage())
        now = time.monotonic()
        count, window_start = self._counts.get(key, (0, now))
        if now - window_start > self._per:
            count, window_start = 0, now
        count += 1
        self._counts[key] = (count, window_start)
        return count <= self._rate
```

Apply this filter to handlers, not loggers — you still want the error counted even when not emitted.

## When not to log

The temptation is to log everything and let the reader filter. The cost is carried by everyone downstream.

Do not log:
- Successful operations in tight inner loops — "processed record 1", "processed record 2" is useless for 10 million records
- Per-record progress in batch jobs — emit one summary at the end: "batch complete: 50000 records, 12 failures, 47s"
- Entering and exiting every function — this is what a debugger is for
- Data that changes too fast to be useful — current queue depth polled every millisecond
- Information that duplicates a metric — if you have a counter for cache hits, you do not also need a log line per hit

The test for whether a log line is worth keeping: "If I saw this in production at 2am, would it help me diagnose the problem, or would it be noise I have to scroll past?" If the answer is noise, remove it.

## Correlation IDs and request context

A log line without context is rarely actionable. A log line that ties to a request ID, user ID, and operation lets you reconstruct exactly what happened.

Use `contextvars.ContextVar` to propagate correlation IDs without threading them through every function call:

```python
import contextvars
_request_id: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")

class CorrelationFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _request_id.get()
        return True
```

Set the context variable at the request boundary (middleware, CLI entry point, task consumer). Every log line emitted during that request automatically carries the ID. Do not pass request IDs as function parameters — it couples every function signature to observability infrastructure.
