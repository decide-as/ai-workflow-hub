# Structured Logging

## Why grep stops working at scale

Unstructured log lines become write-only output at scale. You write them, and nobody ever successfully searches them. `grep "error" app.log` returns 40,000 lines. `grep "error" app.log | grep "user-123"` returns 200 lines, most of which mention "user-1234" or "user-12345" because you interpolated the ID into the middle of a sentence and there's no field boundary.

The fundamental problem: human-readable log lines are not machine-searchable log lines. A message like `"Scaffold completed for my-project in 2.3s using python-agent template"` is pleasant to read in a terminal and useless in a log aggregator. You can't filter by project name without regex. You can't histogram by elapsed time without parsing natural language. You can't correlate across services without a structured trace ID.

Structured logging means emitting log records as key-value data (typically JSON) where context lives in named fields, not inside the message string. It costs almost nothing to implement and transforms logs from write-only output to a queryable data source.

## When to adopt

- **Services, webapps, background workers**: always. These produce logs that must be searched, filtered, and aggregated.
- **CLI tools**: when they support `--verbose` or `--json` output modes. Human-readable default, structured optional.
- **Libraries**: never configure logging format. Emit records with `extra` fields and let the consuming application choose the format.

## JSON formatter

A minimal production-ready formatter for Python's stdlib logging:

```python
import json
import logging
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    """Emit log records as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # Merge structured context passed via extra={}
        for key in ("operation", "project", "template", "elapsed_ms",
                     "error", "correlation_id", "module"):
            if hasattr(record, key):
                entry[key] = getattr(record, key)
        return json.dumps(entry, default=str)
```

This gives you one JSON object per line, which is what every log aggregator expects. No multi-line tracebacks in the JSON value — serialize exceptions as a single string field.

## Structured fields via `extra`

The core discipline: context goes in fields, not in the message string.

```python
# Wrong — context is baked into the string, unsearchable
logger.info(f"Scaffold completed for {name} in {elapsed:.1f}s")

# Right — fields are indexable, filterable, aggregatable
logger.info(
    "Scaffold completed",
    extra={"project": name, "elapsed_ms": round(elapsed * 1000), "template": tpl},
)
```

The message should describe **what happened**. The fields should describe **the context**. If you find yourself writing f-strings with three or more interpolated values, you're embedding structured data in unstructured text.

## Standard field names

Consistency across your codebase means one query syntax works everywhere:

| Field | Type | Purpose |
| ----- | ---- | ------- |
| `operation` | str | High-level action: `scaffold`, `validate`, `doctor` |
| `project` | str | Project name or slug |
| `template` | str | Template type used |
| `elapsed_ms` | int | Duration in milliseconds (not seconds — avoids float formatting issues) |
| `error` | str | Error message on failure |
| `correlation_id` | str | Request or operation trace ID for cross-service correlation |
| `module` | str | Source module name |

Pick names once and enforce them. `elapsed_ms` in one module and `duration_seconds` in another defeats the purpose. A linter rule or a shared constant dict helps.

## Log aggregation readiness

Design logs for the tools that will consume them:

- **One JSON object per line** — multi-line log entries break every line-oriented parser.
- **ISO 8601 timestamps with timezone** — `2026-03-18T14:30:00+00:00`, not `Mar 18 14:30:00` or epoch seconds.
- **`level` as the severity field** — not `severity`, `log_level`, or `loglevel`. Most parsers (ELK, Datadog, CloudWatch Logs Insights) expect `level`.
- **Lowercase field names with underscores** — `correlation_id`, not `correlationId` or `CorrelationID`.
- **Serialize exceptions as a string field** — `"error": "ValueError: invalid template\\nTraceback..."`, not a multi-line value.

## Development vs. production format

Nobody wants to read JSON in their terminal during development. Support both formats via environment configuration:

```python
def configure_logging() -> None:
    handler = logging.StreamHandler()
    if os.getenv("LOG_FORMAT") == "json":
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(levelname)-8s %(name)s: %(message)s")
        )
    logging.root.addHandler(handler)
    logging.root.setLevel(os.getenv("LOG_LEVEL", "INFO"))
```

Development gets human-readable output. Production gets JSON. Same log calls, same `extra` fields — the formatter decides the output shape. Never maintain two sets of log statements.

## Anti-patterns

**Logging and praying** — emitting hundreds of log lines with no structured fields, hoping future-you will figure out what to grep for. You won't.

**The everything-is-INFO problem** — when every log line is INFO, filtering by level is useless. Use DEBUG for internal state, INFO for operational milestones, WARNING for recoverable issues, ERROR for failures.

**Logging sensitive data** — user passwords, API keys, full request bodies with PII. Structured logging makes this worse because fields are explicitly named and easily searched. Redact before logging, not after.

**f-string addiction** — `logger.info(f"Processing {len(items)} items for user {user_id}")` is convenient and unsearchable. The extra 30 seconds to use `extra={}` pays for itself the first time you need to query by user ID.
