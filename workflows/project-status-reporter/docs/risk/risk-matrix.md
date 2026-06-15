# Risk Matrix (phase-graduated)

This matrix defines which risks must be evaluated at each project phase. Each tier includes all risks from previous tiers. Read `project-meta.yaml` to determine the current phase, then evaluate against the applicable tier.

AI-specific risks are in `ai-risk-controls.md` and apply at ALL tiers.

---

## Tier 0 — Always enforced (discovery, poc)

### Secrets and credentials

- CRED-01: No hardcoded API keys, tokens, or passwords in source (Critical)
- CRED-02: No secrets in git history (Critical)
- CRED-03: No .env files committed to repository (Critical)
- TEST-05: No real secrets or PII in test fixtures (High)
- GIT-01: No secrets recoverable from git history (Critical)
- GIT-09: No SSH keys or PATs committed to any repository (Critical)

### Injection — obvious cases

- INJ-01: No string concatenation in SQL queries (Critical)
- INJ-02: No OS command injection via shell=True with user input (Critical)
- INJ-03: No template injection via unsanitized user input (Critical)
- INJ-10: No eval()/exec() with externally influenced input (Critical)
- PY-01: No unsafe eval()/exec() (Critical)
- PY-02: No insecure pickle deserialization of untrusted data (Critical)
- PY-03: No yaml.load() without SafeLoader on untrusted input (Critical)
- PY-04: No subprocess shell=True with user input (Critical)
- PY-19: No jsonpickle.decode() on untrusted input (Critical)
- SER-01: No pickle on untrusted data (Critical)
- SER-02: No YAML deserialization RCE (Critical)
- SER-03: No jsonpickle on untrusted data (Critical)
- CWE-02: No SQL injection — CWE-89 (Critical)
- CWE-09: No OS command injection — CWE-78 (Critical)
- CWE-10: No code injection — CWE-94 (Critical)
- CWE-25: No command injection — CWE-77 (Critical)

### Destructive operations

- GIT-02: No force push without --force-with-lease (High)
- GIT-03: No git push --mirror (Critical)
- INFRA-03: No debug mode in production config (Critical)
- CONF-01: No DEBUG=True in production (Critical)
- CONF-02: No default database credentials (Critical)
- SANS-04: No hardcoded credentials (Critical)

---

## Tier 1 — Prototype and above (adds to Tier 0)

### Input validation and error handling

- SANS-01: Validate all external input for type, range, length, format (High)
- ERR-01: No stack traces exposed to users (Medium)
- ERR-02: No swallowed/silent exceptions (High)
- ERR-03: No overly broad exception handling without re-raise (Medium)
- ERR-04: No information leakage in error messages (High)
- ERR-05: Error handling on external calls — network, file, API (Medium)
- ERR-08: Resource cleanup on exception — use context managers (Medium)
- OWASP-12: No stack traces or internal info in error responses (Medium)
- CROSS-21: Resource cleanup in exception paths (Medium)
- CONF-05: No verbose error pages in production (High)
- DATA-03: Output encoded/escaped for context (High)
- CWE-12: No sensitive info in error messages (High)
- CWE-06: No path traversal — CWE-22 (High)
- FS-01: No path traversal via user input (High)
- FS-02: No unsafe temporary file creation (Medium)
- FS-08: No directory traversal in archive extraction (High)

### Dependencies

- DEP-03: Pin dependency versions (Medium)
- DEP-09: No malicious URLs in requirements files (High)
- SC-02: Check for typosquatted package names (High)
- PY-05: Validate tarfile member paths before extraction (High)
- PY-12: No assert for input validation (Medium)
- PY-13: No mutable default arguments (Low)
- PY-14: No __import__ with user input (High)
- PY-18: No pip install from unverified URLs (High)
- SER-04: No shelve on untrusted data (Critical)
- GIT-04: Branch protection on main/master (High)
- GIT-06: .gitignore covers .env, __pycache__, IDE configs (Medium)
- GIT-11: No git hook bypass (Medium)
- PY-10: No tempfile.mktemp() — use mkstemp (Medium)
- CWE-18: No deserialization of untrusted data — CWE-502 (Critical)

---

## Tier 2 — MVP and above (adds to Tier 1)

### Systematic security

- OWASP-01: Authorization checks on all endpoints (Critical)
- OWASP-02: No horizontal privilege escalation (Critical)
- OWASP-03: No vertical privilege escalation (Critical)
- OWASP-08: No weak/deprecated cryptographic algorithms for security (Critical)
- CWE-01: No XSS — CWE-79 (High)
- CWE-03: CSRF protection on state-changing endpoints — CWE-352 (High)
- CWE-04: Authorization on all resources — CWE-862 (Critical)
- CWE-15: File upload type and size validation — CWE-434 (Critical)
- CWE-17: Authentication on critical functions — CWE-306 (Critical)
- CWE-19: Consistent access control — CWE-284 (High)
- CWE-22: No SSRF — CWE-918 (High)
- AUTH-02: Rate limiting on login endpoints (High)
- AUTH-07: No JWT algorithm confusion (Critical)
- AUTH-09: Authorization on admin endpoints (Critical)
- AUTH-10: No privilege escalation via parameter tampering (Critical)
- CROSS-22: Robust authentication mechanisms (Critical)
- CROSS-10: Cryptographic RNG for tokens and session IDs (High)
- CROSS-08: No open redirects (Medium)
- API-01: Object-level authorization on API endpoints (Critical)
- API-02: Strong API authentication (Critical)
- API-05: Function-level authorization on API endpoints (Critical)
- API-07: No SSRF in API endpoints (High)
- INJ-04: No LDAP injection (High)
- INJ-06: No CRLF/header injection (High)
- INJ-08: No log injection (High)
- INJ-11: No NoSQL injection (Critical)
- SANS-02: No XXE (High)
- SANS-05: Credentials encrypted in transit and at rest (High)
- SANS-06: Sensitive data encrypted (High)
- SER-05: No XXE in deserialization (High)
- SER-08: No XML bomb / billion laughs (High)

### Data handling

- DATA-01: No PII in logs or responses (High)
- DATA-02: No mass assignment (High)
- DATA-04: No IDOR (High)
- DATA-10: No unvalidated redirects (Medium)
- PY-07: Use defusedxml for XML parsing (High)
- PY-15: Use secrets module for security-sensitive randomness (High)
- PY-16: No f-string/format injection with untrusted input (Medium)
- PY-11: No ReDoS on user-controlled input (Medium)
- CROSS-13: No catastrophic regex backtracking (Medium)
- CRED-07: API key permissions scoped to need (High)
- CRED-09: No secrets in client-side code (High)
- CRED-10: No plain-text secret storage (High)
- CRED-11: Secret scanning in pre-commit hooks (Medium)
- CRED-13: No tokens in URL parameters (High)
- FS-04: File upload size limits (Medium)
- FS-05: File upload type validation (High)
- FS-06: Secure file permissions on created files (Medium)
- FS-09: Content-type validation by magic bytes (Medium)
- CONF-04: CSRF protection enabled (High)
- CONF-09: Rate limiting on auth and API endpoints (High)
- CONF-10: No insecure default config values (High)
- ERR-06: Consistent HTTP error codes (Low)
- ERR-07: Security controls fail closed, not open (Critical)

### Logging and testing

- LOG-01: No sensitive data in logs (High)
- LOG-03: No log injection (Medium)
- TEST-01: Test coverage on critical paths (High)
- TEST-02: No flaky tests (Medium)
- TEST-03: Tests verify behavior, not implementation (Medium)
- TEST-04: Negative and error path tests exist (High)
- TEST-06: Security-focused tests exist (High)
- TEST-07: No over-mocking (Medium)
- TEST-08: Regression tests for bug fixes (Medium)
- TEST-09: No tests that never fail (Medium)
- GIT-07: No large binary files committed (Medium)
- GIT-08: No sensitive data in commit messages (Medium)
- GIT-10: Correct merge conflict resolution (High)
- SC-08: No pinned versions with known CVEs (High)
- SC-09: No transitive dependency vulnerabilities (High)
- DEP-01: No known CVEs in direct dependencies (High)
- DEP-02: No known CVEs in transitive dependencies (High)
- DEP-08: No phantom dependencies (Medium)
- CRED-04: No secrets in CI/CD logs (High)

### Code quality

- QUAL-01: No excessive cyclomatic complexity (Medium)
- QUAL-02: No dead/unreachable code (Low)
- QUAL-03: No significant code duplication (Medium)
- QUAL-04: Public functions have docstrings (Low)
- QUAL-05: No god classes or functions (Medium)
- QUAL-07: No premature optimization (Low)
- QUAL-08: No unexplained magic numbers/strings (Low)
- QUAL-09: Consistent error handling patterns (Medium)
- QUAL-11: No circular imports (Medium)
- QUAL-13: No commented-out code in production (Low)
- QUAL-14: Consistent naming conventions (Low)

---

## Tier 3 — Alpha and above (adds to Tier 2)

### Concurrency

- CONC-01: No TOCTOU race conditions (High)
- CONC-02: No deadlock potential (High)
- CONC-03: No data races on shared mutable state (High)
- CONC-04: No resource starvation (Medium)
- CONC-05: No livelock patterns (Medium)
- CONC-06: Atomic operations for compound state changes (High)
- CONC-08: Correct double-checked locking (Medium)
- CONC-09: Connection pool sizing and timeouts (High)
- CONC-10: File lock timeouts (Medium)
- PY-08: Cookie parsing safe from quadratic complexity (Medium)
- PY-09: HTML parsing safe from quadratic complexity (Medium)
- PY-17: GIL does not protect compound operations (Medium)
- PY-06: Zipfile safe from infinite loops (Medium)

### API security

- API-03: No excessive data in API responses (High)
- API-04: Pagination, rate limits, request size caps (High)
- API-06: Anti-automation on sensitive business flows (High)
- API-10: Validate data from third-party APIs (Medium)
- API-11: No GraphQL introspection in production (Medium)
- API-12: API versioning strategy exists (Medium)
- CROSS-01: No algorithmic complexity DoS (High)
- CROSS-06: WebSocket auth and origin validation (Medium)
- CROSS-09: Constant-time comparison for secrets (Medium)
- CROSS-11: No business logic abuse paths (High)
- CROSS-17: Unicode/encoding handled correctly (Medium)
- CROSS-19: Content-Type validation on API endpoints (Medium)
- CROSS-20: No unsafe reflection from user input (High)

### Trust boundaries and session management

- AUTH-01: Rate limiting and lockout on login (High)
- AUTH-04: Session regeneration after login (High)
- AUTH-05: Session invalidation on logout (Medium)
- AUTH-06: Secure password recovery flow (High)
- AUTH-08: No auth tokens in localStorage (Medium)
- AUTH-11: Correct OAuth implementation (High)
- AUTH-12: Reasonable session expiration (Medium)
- CONF-06: Secure cookie attributes (Medium)
- CROSS-16: Secure flag on session cookies (Medium)
- CWE-13: Proper privilege management (High)
- CWE-20: No auth bypass via user-controlled key (High)
- CWE-21: Resource allocation limits (High)
- INJ-05: No XPath injection (High)
- INJ-07: No email header injection (Medium)
- INJ-09: No CSV/formula injection (Medium)
- INJ-12: No expression language injection (High)
- SER-06: No insecure custom JSON decoders (High)
- DATA-08: CSV export escapes formula prefixes (Medium)
- DATA-09: Unicode normalization handled (Medium)
- FS-03: No symlink following attacks (High)
- FS-07: Zip bomb protection (Medium)
- CRED-12: Strong JWT secrets (Critical)

### Observability

- LOG-02: Audit logging for security events (High)
- LOG-04: Correlation IDs in distributed services (Medium)
- LOG-06: No debug logging in production (Low)
- LOG-08: Timestamps include timezone (Low)
- OWASP-11: Security event logging (High)
- QUAL-06: No tight coupling (Medium)
- QUAL-10: Type hints on public interfaces (Low)
- QUAL-12: Technical debt tracked (Medium)
- DEP-04: Dependencies within 6 months of latest (Medium)
- SANS-03: Resource consumption limits on user input (High)

---

## Tier 4 — Beta, pilot and above (adds to Tier 3)

### Infrastructure and deployment

- INFRA-01: No publicly exposed storage buckets (Critical)
- INFRA-02: No exposed database ports (Critical)
- INFRA-04: WAF/rate limiting at edge (High)
- INFRA-05: Patched OS and runtime (High)
- INFRA-06: Admin interfaces behind VPN/IP restriction (Critical)
- INFRA-07: IAM policies follow least privilege (High)
- INFRA-08: Network segmentation between services (High)
- INFRA-09: Containers not running as root (High)
- INFRA-10: Kubernetes API secured (Critical)
- INFRA-11: TLS on internal communications (Medium)
- INFRA-12: Cloud metadata endpoint protection (Critical)

### Supply chain and dependencies

- SC-01: No dependency confusion (Critical)
- SC-03: Monitor for compromised maintainer accounts (Critical)
- SC-04: Verify package provenance (Critical)
- SC-05: No install-time code execution from untrusted packages (Critical)
- SC-06: Monitor for protestware (High)
- SC-07: CI/CD publish tokens scoped and protected (Critical)
- SC-10: No abandoned critical dependencies (Medium)
- SC-11: License compatibility verified (Medium)
- SC-12: Dependency capabilities reviewed (High)
- SC-13: Package repository links verified (Medium)
- SC-14: Build tool integrity verified (Critical)
- DEP-05: License compliance verified (Medium)
- DEP-06: Bus-factor assessed on critical dependencies (Medium)
- DEP-07: Lockfile includes hash verification (High)
- OWASP-04: CORS configured correctly (High)
- OWASP-05: No security misconfiguration (High)
- OWASP-06: Security headers present (Medium)
- OWASP-07: Supply chain integrity verified (Critical)
- OWASP-09: No insecure design flaws (High)
- OWASP-10: Software integrity verified (High)

### Data handling and compliance

- DATA-05: Data retention policies defined (Medium)
- DATA-06: Sensitive database fields encrypted (High)
- DATA-07: Data masked in non-production (Medium)
- CRED-05: No secrets in Docker layers (High)
- CRED-06: Credential rotation documented (High)
- CRED-08: No shared service accounts (Medium)
- AUTH-03: MFA on admin accounts (High)
- CONF-03: CORS policy not overly permissive (High)
- CONF-07: No dev dependencies in production (Medium)
- CONF-08: CSP configured correctly (Medium)
- CROSS-02: TLS certificates validated (High)
- CROSS-03: DNS rebinding protection (High)
- CROSS-04: Clickjacking protection (Medium)
- CROSS-07: No subdomain takeover risk (High)
- CROSS-12: Prototype pollution protection (High)
- CROSS-18: Backup and recovery procedures exist (High)
- API-08: API security headers present (Medium)
- API-09: API inventory managed (Medium)
- TEST-10: Test environment matches production (Medium)
- LOG-05: Log files not web-accessible (High)
- LOG-07: Alerting on security events (High)

### Build and CI/CD

- CI-01: Required approvals before production deploy (High)
- CI-02: CI/CD accounts follow least privilege (High)
- CI-03: CI dependency installation verified (Critical)
- CI-04: Pipeline definitions protected from tampering (Critical)
- CI-05: CI jobs scoped to required access (High)
- CI-06: CI/CD credentials managed securely (Critical)
- CI-07: CI system patched and configured (High)
- CI-08: Third-party CI integrations reviewed (High)
- CI-09: Build artifacts signed/verified (High)
- CI-10: CI/CD audit logging enabled (Medium)
- CI-11: No GitHub Actions script injection (Critical)
- CI-12: CI dependency cache isolation (High)
- CI-13: Build runner isolation (High)
- CI-14: Self-hosted runners secured (High)

---

## Tier 5 — Validation, production (adds to Tier 4)

### Full coverage — no exceptions

- CWE-05: No out-of-bounds write in native code (Critical)
- CWE-07: No use-after-free (Critical)
- CWE-08: No out-of-bounds read (High)
- CWE-11: No buffer overflow (Critical)
- CWE-14: No stack buffer overflow (Critical)
- CWE-16: No heap buffer overflow (Critical)
- CWE-23: No NULL pointer dereference (Medium)
- CWE-24: No integer overflow in size calculations (High)
- CONC-07: No priority inversion (Medium)
- CROSS-05: No HTTP request smuggling (High)
- CROSS-14: No integer overflow leading to buffer overflow (Critical)
- CROSS-15: No uncontrolled format string (Critical)
- SER-07: Protocol buffer unknown field handling reviewed (Medium)
- SC-15: Registry integrity verified (Critical)
- GIT-05: Commit signing enforced (Medium)
- CROSS-12: No prototype pollution in JS (High)

### Static analysis and audit

- All findings from `bandit -r <package>/ -q` addressed
- All findings from `pip-audit` resolved
- No TODO/FIXME in production code paths
- All OWASP Top 10 categories evaluated and addressed
- All CWE Top 25 categories evaluated and addressed
