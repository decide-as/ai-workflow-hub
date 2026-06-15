# CI Pipeline Design

## The compounding cost of slow pipelines

Slow CI is the silent productivity killer. Every minute added to the pipeline compounds across every PR, every developer, every day. A team of five pushing three PRs each per day with a 15-minute pipeline burns 3.75 hours of waiting time daily — and that's just wall-clock time. The real cost is context-switching: a developer who kicks off CI and opens Twitter isn't coming back to the same mental state in 15 minutes.

But speed without reliability is worse. A fast pipeline that randomly fails teaches developers to ignore it, hit "re-run," and merge anyway. The pipeline becomes theater — it looks like quality enforcement but enforces nothing.

The goal: a pipeline that is fast enough to wait for (under 10 minutes), reliable enough to trust (under 1% flake rate), and ordered so that the cheapest checks fail first.

## Fail-fast ordering

Run the cheapest checks first. If formatting is wrong, there's no point spending 4 minutes on integration tests:

1. **Lint + format check** (5-15 seconds) — syntax errors, import ordering, style violations. This catches the majority of "oops" commits.
2. **Type check** (10-30 seconds) — type mismatches, missing annotations, impossible call signatures.
3. **Unit tests** (30 seconds - 2 minutes) — isolated function logic, no I/O, no network.
4. **Integration tests** (1-5 minutes) — multi-module interaction, filesystem fixtures, database access.
5. **Coverage gate** (seconds, after tests) — enforces minimum thresholds. Runs on test output, not as a separate step.
6. **Build / package** (1-3 minutes) — confirms the artifact actually builds. Catches missing dependencies and packaging bugs.

Structure the pipeline so that each stage depends on the previous one. If lint fails, tests never start. This isn't just about saving CI minutes — it's about giving developers the most useful feedback first.

## Test matrix strategy

Every axis in a test matrix multiplies your CI time. A 3-OS × 3-Python-version matrix turns a 5-minute test suite into a 45-minute pipeline (or a very expensive parallel bill).

The decision framework:

| Axis | Include when | Skip when |
| ---- | ------------ | --------- |
| Python/Node version | You're a library consumed by others | You're an application that controls its runtime |
| OS | You shell out, use path manipulation, or distribute binaries | You're a web service deployed on one OS |
| Dependency version | You support multiple major versions of a key dependency | You pin dependencies and deploy what you test |

For most applications, the matrix should be: **one OS, one language version, pinned dependencies**. Run the full matrix on merge to main or as a weekly scheduled job — not on every PR.

## Caching strategy

Re-downloading dependencies on every run is pure waste. Cache the dependency installation, keyed to the lockfile:

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('pyproject.toml') }}
    restore-keys: |
      ${{ runner.os }}-pip-
```

Rules for effective caching:

- **Cache installations, not source code** — source changes every commit; dependencies change rarely.
- **Key on the lockfile hash** — when dependencies change, the cache is automatically invalidated.
- **Use restore-keys for partial hits** — a stale cache with most packages installed is faster than a cold start.
- **Don't cache test output or build artifacts between runs** — these should always be fresh. Stale caches hide bugs.

## Parallelism

Independent jobs should run concurrently. The dependency graph for a typical pipeline:

```text
[lint] ──────────────┐
[type-check] ────────┤
                     ├──→ [unit-tests] ──→ [coverage-gate]
[security-audit] ────┘         │
                               ├──→ [build]
                     [integration-tests] ──┘
```

Lint, type-check, and security audit have no dependencies on each other — run them in parallel. Tests depend on linting passing (no point testing code that doesn't parse). Build depends on tests passing.

Express these dependencies explicitly in your CI configuration (`needs` in GitHub Actions, `dependencies` in GitLab CI). Implicit ordering through pipeline stages is coarser and wastes time.

## Artifact management

- Store build outputs (wheels, container images, binaries) as CI artifacts tagged with the commit SHA.
- Set retention policies: feature branch artifacts expire after 7 days; release artifacts are kept indefinitely.
- Never store secrets, credentials, or environment-specific config in artifacts.
- For container images: tag with both the commit SHA (for traceability) and the version (for deployment).

## Flaky test policy

A flaky test — one that sometimes passes and sometimes fails without code changes — is more dangerous than a missing test. A missing test is a known gap. A flaky test teaches the team to ignore CI failures.

The policy:

1. **Quarantine immediately** — mark with `@pytest.mark.flaky` and move to a separate CI job that doesn't block merges.
2. **File a bug** — a flaky test is a bug, usually a race condition, shared state leak, or time-dependent assertion.
3. **Fix within one sprint** — quarantine is triage, not treatment. If a flaky test sits quarantined for a month, delete it.
4. **Track flake rate** — if a test flakes on more than 2% of runs, it is a priority fix. Most CI platforms can report this.
5. **Never "just re-run"** — re-running to get green is how teams end up with 15-minute pipelines that need 3 attempts to pass.

## Security in CI

CI pipelines are high-value targets because they have write access to your artifacts and often hold deployment credentials:

- **Pin actions to commit SHAs**, not tags. Tags can be force-pushed: `uses: actions/checkout@a5ac7e51b41094c92402da3b24376905380afc29` not `uses: actions/checkout@v4`. Use Dependabot or Renovate to update pinned SHAs.
- **Never store secrets in CI config files** — use the platform's secret management. Secrets in YAML files end up in git history.
- **Run dependency audits on every PR** — `pip-audit` or `npm audit` catch known vulnerabilities before they ship.
- **Enable branch protection** — require CI to pass and reviews to be approved before merge. Without this, CI is advisory, not enforcement.
- **Minimize token scopes** — CI tokens should have the minimum permissions needed. A pipeline that runs tests doesn't need write access to the package registry.

## Performance targets

| Metric | Target | Reality check |
| ------ | ------ | ------------- |
| Lint + type check | < 30 seconds | If this takes longer, your linter config or codebase needs attention |
| Unit tests | < 2 minutes | If longer, you probably have integration tests misclassified as unit tests |
| Full pipeline | < 10 minutes | Beyond this, developers context-switch and stop waiting for results |
| Flake rate | < 1% | Above 2%, CI trust begins to erode. Above 5%, people stop looking at results |

When you exceed these targets, the fix is almost never "buy bigger CI runners." Profile first: are tests actually slow, or is the pipeline serializing jobs that could run in parallel? Is the cache miss rate high? Are integration tests re-creating fixtures that could be shared?
