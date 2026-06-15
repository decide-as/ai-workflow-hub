# Configuration Management

## Secrets are not config

The most important distinction you can make in this space: **secrets rotate, config doesn't**. This is not just a semantic difference — it determines where things live, who can access them, and how failures manifest.

Config: database hostnames, port numbers, feature flag values, log levels, connection pool sizes. These are versioned, auditable, and change through your normal deployment process. They can live in a config file committed to your repo, or in environment variables set at deploy time.

Secrets: database passwords, API keys, signing keys, certificates. These must never touch disk unencrypted, must never appear in logs, must never be committed to version control (even in private repos — your git history is forever), and must be rotatable without a deployment.

The operational pattern that works: secrets go through a secrets manager (Vault, AWS Secrets Manager, 1Password Secrets Automation). Your application receives a reference (`SECRET_DB_PASSWORD_PATH=/run/secrets/db`) and reads the secret at startup or on each request. Your config (including the reference path) is version-controlled. The secret itself is not.

What breaks this distinction in practice: developers who put a `SECRET_KEY=...` in `.env.example` "as a placeholder." The placeholder becomes the real value in staging. The staging value gets copied to production. Now your secret is in git.

## Config layering and why precedence order matters

The correct precedence order (lowest to highest priority):

```
defaults (hardcoded in code)
  → config file (e.g., config.yaml)
    → environment variables
      → CLI flags
```

The reason this order matters: defaults should be sensible for development. Config files should be environment-specific. Environment variables should override for deployment context. CLI flags should override for one-off runs.

What breaks when you invert this: if env vars take lower precedence than config files, your production environment variables do nothing when a config file is present. This is the silent failure that causes "I set the env var but it's using the wrong value" incidents.

The implementation pattern in Python:

```python
# Pydantic Settings handles this correctly out of the box
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    db_host: str = "localhost"  # default
    
    model_config = ConfigDict(
        env_file=".env",          # env file lower priority than actual env vars
        env_file_encoding="utf-8"
    )
```

Never implement your own precedence chain by hand. The logic is subtle and you'll get it wrong in an edge case.

## Config validation beyond types

Type validation (this field is an int, this field is a str) is table stakes. The failures that actually reach production are semantic:

- `workers: 0` — valid integer, crashes your server
- `timeout: -1` — valid integer, means infinite timeout in some libraries and "use default" in others
- `host: "localhost"` in production — valid string, wrong for your environment
- `max_connections: 10` with `pool_size: 100` — individually valid, semantically incoherent

Cross-field validation example with Pydantic:

```python
from pydantic import BaseModel, model_validator

class DatabaseConfig(BaseModel):
    pool_min: int
    pool_max: int
    
    @model_validator(mode='after')
    def pool_min_lte_max(self) -> 'DatabaseConfig':
        if self.pool_min > self.pool_max:
            raise ValueError(f"pool_min ({self.pool_min}) must be <= pool_max ({self.pool_max})")
        return self
```

Mutual exclusion is harder to validate but critical: if your config supports both `DATABASE_URL` (a connection string) and `DB_HOST`/`DB_PORT`/`DB_NAME` (individual fields), define which takes precedence and validate that both are not set to different values. Silent config conflicts are the worst kind.

Validate at startup, fail loudly, fail early. A `ConfigurationError` at process start is infinitely better than an `AttributeError` on the first request.

## Config drift in long-running services

Config drift is when your running service has different effective config than what your deployment manifests say. It happens because:

1. Someone edited an env var in the cloud console "temporarily" and forgot to update the manifest.
2. A secret rotation changed a value that a cached connection pool still has the old value of.
3. A feature flag was toggled in a feature flag service while the service was running.

Detection: expose a `/config` or `/health/detail` endpoint (protected, not public) that returns the effective config your application actually loaded. Not what the manifest says — what the process is actually using. Diff this against your expected config in your monitoring.

The practical discipline: treat config changes like code changes. They go through pull requests, they have reviewers, they get deployed via your normal pipeline. "I'll just change this in the console real quick" is how config drift starts.

## Feature flags are not config

This is a common and painful conflation. Config is relatively static operational data. Feature flags are dynamic behavior switches that business stakeholders change on a per-user, per-tenant, or per-experiment basis.

Mixing them causes: feature flag changes triggering config validation, config management systems not built for the high read volume of per-request flag evaluation, and audit trails that conflate "we changed the database pool size" with "we enabled the new checkout flow for 5% of users."

Use a dedicated feature flag system (LaunchDarkly, Flagsmith, Unleash, or a simple database table) for feature flags. Use your config system for config. The boundary is: if a non-engineer business stakeholder should be able to change it without a deployment, it's a feature flag.

## The CI config trap

Tests pass locally, fail in CI. The most common cause: your local `.env` file has values that don't exist in CI.

The failure mode is worse than a missing variable (which would throw a clear error) — it's a variable that exists locally with one value and doesn't exist in CI, so your application falls back to a default. The tests pass with the default and you never notice. Until the default is wrong in production.

The fix: maintain a `.env.test` that explicitly sets every variable your test suite needs, commit it (without secrets — use obvious placeholder values), and use it in CI:

```yaml
# CI workflow
- name: Run tests
  env:
    DATABASE_URL: postgresql://localhost/test
    REDIS_URL: redis://localhost:6379/0
    SECRET_KEY: not-a-real-secret-for-testing-only
  run: pytest
```

Never rely on CI environment variables being set by convention or memory. Make them explicit and version-controlled alongside the tests that need them.
