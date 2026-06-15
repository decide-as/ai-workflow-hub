# Risk Registry v1.0

Comprehensive risk catalogue for AI-assisted software development. Every risk is assigned a stable ID, phase tier, severity, and check method. This registry governs the risk assessment process enforced before every pull request in scaffolded projects.

<!-- STATS:risk-summary -->
**Total risks:** 359 (282 general + 77 AI-specific)
**Domains:** 19
**Phase tiers:** 6 (0-5)
**Authoritative sources:** 65+
<!-- /STATS:risk-summary -->

---

## Tier-to-Phase Mapping

| Tier | Phases | Focus |
|---|---|---|
| 0 | discovery, poc | Secrets, obvious injection, destructive ops, ALL AI risks |
| 1 | prototype | + basic validation, error handling, unsafe deserialization, dependency pinning |
| 2 | mvp | + systematic security (SQL/XSS/CSRF), logging, test coverage on critical paths |
| 3 | alpha | + concurrency, API security, trust boundaries, session management |
| 4 | beta, pilot | + infrastructure, supply chain, data handling, full OWASP Top 10 |
| 5 | validation, production | Everything. No exceptions. Static analysis, full CWE/SANS coverage |

Each tier **includes all risks from previous tiers**.

---

## Severity Definitions

| Severity | Meaning |
|---|---|
| Critical | Exploitable with high impact. Must be fixed immediately at the applicable tier. |
| High | Significant risk that should be fixed before PR merge at the applicable tier. |
| Medium | Moderate risk. Advisory at earlier tiers, blocking at later tiers. |
| Low | Minor concern. Advisory only, but should be addressed when practical. |

---

# Part A: General Codebase Risks (296 risks)

---

## Domain 1: Secrets and Credential Management (13 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| CRED-01 | Hardcoded API keys in source code | 0 | Critical | Grep for patterns: API_KEY, SECRET, TOKEN, PASSWORD in source files. Check for base64-encoded strings and hex sequences >20 chars. |
| CRED-02 | Secrets committed to git history | 0 | Critical | Run `git log -p --diff-filter=D` on sensitive file patterns. Use git-secrets or trufflehog if available. |
| CRED-03 | .env files committed to repository | 0 | Critical | Check `git ls-files` for `.env`, `.env.local`, `.env.production`. Verify `.gitignore` includes `.env*`. |
| CRED-04 | Secrets in CI/CD logs | 2 | High | Review CI config for `echo`, `print`, or `cat` of secret-containing variables. Check for `--verbose` flags on commands that handle secrets. |
| CRED-05 | Secrets in Docker images/layers | 4 | High | Review Dockerfiles for `COPY .env`, `ARG PASSWORD`, or multi-stage builds that leak secrets in early stages. |
| CRED-06 | Unrotated credentials | 4 | High | Check for credential rotation documentation or automation. Review creation dates of API keys if accessible. |
| CRED-07 | Overly broad API key permissions | 2 | High | Review API key scopes in code and configuration. Check for wildcard permissions. |
| CRED-08 | Shared service accounts | 4 | Medium | Check for shared credential files, common usernames across services. |
| CRED-09 | Secrets in client-side code | 2 | High | Grep JavaScript/frontend bundles for API keys, tokens. Check for keys in HTML templates. |
| CRED-10 | Plain-text secret storage | 2 | High | Review config files for unencrypted passwords, database URLs with credentials. |
| CRED-11 | Missing secret scanning | 2 | Medium | Check for pre-commit hooks that scan for secrets. Verify CI pipeline includes secret scanning step. |
| CRED-12 | JWT secret weakness | 3 | Critical | Check JWT signing configuration for short secrets, default values, or symmetric keys where asymmetric is appropriate. |
| CRED-13 | Tokens in URL parameters | 2 | High | Grep for token/key/secret in URL query string construction. Check for sensitive data in GET request parameters. |

---

## Domain 2: Injection (12 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| INJ-01 | SQL injection | 0 | Critical | Check for string concatenation or f-strings in SQL queries. Verify parameterized queries or ORM usage. |
| INJ-02 | OS command injection | 0 | Critical | Check `subprocess.call`, `os.system`, `os.popen` for user-controlled input. Verify `shell=False`. |
| INJ-03 | Template injection (SSTI) | 0 | Critical | Check for user input passed directly to template rendering (Jinja2, Mako). Verify autoescape enabled. |
| INJ-04 | LDAP injection | 2 | High | Check LDAP queries for unsanitized user input. Verify proper escaping with ldap3 or equivalent. |
| INJ-05 | XPath injection | 3 | High | Check XML/XPath queries for user-controlled input without parameterization. |
| INJ-06 | Header injection (CRLF) | 2 | High | Check HTTP response header construction for user input. Verify no raw \r\n in header values. |
| INJ-07 | Email header injection | 3 | Medium | Check email sending code for user input in To, CC, BCC, Subject fields without sanitization. |
| INJ-08 | Log injection | 2 | High | Check logging calls for unsanitized user input. Verify no CRLF or format string injection in log messages. |
| INJ-09 | CSV/formula injection | 3 | Medium | Check CSV/Excel export for user data containing `=`, `+`, `-`, `@` prefixes without escaping. |
| INJ-10 | Code injection via eval/exec | 0 | Critical | Grep for `eval(`, `exec(`, `compile(` with any externally influenced input. |
| INJ-11 | NoSQL injection | 2 | Critical | Check MongoDB/NoSQL queries for unsanitized user input, especially `$where`, `$regex`, `$gt` operators. |
| INJ-12 | Expression Language injection | 3 | High | Check template engines and expression evaluators for user-controlled expressions. |

---

## Domain 3: OWASP Top 10 (2025) — Additional Items (12 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| OWASP-01 | Broken access control (A01:2025) | 2 | Critical | Review authorization checks on all endpoints. Verify role-based access on data operations. |
| OWASP-02 | Horizontal privilege escalation | 2 | Critical | Check for user ID in query params/path that isn't verified against session user. |
| OWASP-03 | Vertical privilege escalation | 2 | Critical | Check admin endpoints for role verification. Test non-admin access to admin routes. |
| OWASP-04 | CORS misconfiguration | 4 | High | Check Access-Control-Allow-Origin for wildcard `*` with credentials. Review CORS middleware config. |
| OWASP-05 | Security misconfiguration (A02:2025) | 4 | High | Check for default configs, verbose errors, unnecessary features enabled in production. |
| OWASP-06 | Missing security headers | 4 | Medium | Check for CSP, X-Frame-Options, X-Content-Type-Options, HSTS headers in responses. |
| OWASP-07 | Software supply chain failures (A03:2025) | 4 | Critical | Verify dependency lockfiles exist, packages are from trusted registries, signatures verified. |
| OWASP-08 | Cryptographic failures (A04:2025) | 2 | Critical | Check for MD5, SHA1 for passwords. Verify TLS in transit. Check for hardcoded crypto keys. |
| OWASP-09 | Insecure design (A06:2025) | 4 | High | Review for fundamental design flaws: missing threat modeling, insecure patterns. |
| OWASP-10 | Software/data integrity failures (A08:2025) | 4 | High | Check for unsigned updates, insecure CI/CD, auto-update without verification. |
| OWASP-11 | Security logging failures (A09:2025) | 3 | High | Verify logging of auth events, access control failures, input validation failures. |
| OWASP-12 | Mishandling of exceptions (A10:2025) | 1 | Medium | Check for stack traces in responses, unhandled exceptions, information leakage in errors. |

---

## Domain 4: CWE Top 25 (2025) (25 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| CWE-01 | Cross-site scripting — CWE-79 | 2 | High | Check HTML output for unescaped user input. Verify template autoescape. Review innerHTML usage. |
| CWE-02 | SQL injection — CWE-89 | 0 | Critical | (See INJ-01) |
| CWE-03 | Cross-site request forgery — CWE-352 | 2 | High | Check state-changing endpoints for CSRF tokens. Verify middleware enabled. |
| CWE-04 | Missing authorization — CWE-862 | 2 | Critical | Review endpoints for authorization decorators/middleware. Check data access paths. |
| CWE-05 | Out-of-bounds write — CWE-787 | 5 | Critical | Review C extensions, buffer operations, ctypes usage. Check array index bounds. |
| CWE-06 | Path traversal — CWE-22 | 1 | High | Check file operations for user-controlled paths. Verify `pathlib.resolve()` and containment checks. |
| CWE-07 | Use after free — CWE-416 | 5 | Critical | Review C extensions and native code for memory management. Check ctypes pointer usage. |
| CWE-08 | Out-of-bounds read — CWE-125 | 5 | High | Review native extensions for buffer reads beyond allocated size. |
| CWE-09 | OS command injection — CWE-78 | 0 | Critical | (See INJ-02) |
| CWE-10 | Code injection — CWE-94 | 0 | Critical | (See INJ-10) |
| CWE-11 | Buffer overflow — CWE-120 | 5 | Critical | Review C/C++ extensions for unbounded memcpy, strcpy, gets. |
| CWE-12 | Sensitive information exposure — CWE-200 | 1 | High | Check error messages, logs, API responses for internal paths, versions, stack traces. |
| CWE-13 | Improper privilege management — CWE-269 | 3 | High | Review privilege elevation code, sudo/setuid operations, service account permissions. |
| CWE-14 | Stack buffer overflow — CWE-121 | 5 | Critical | Review C extensions for stack-allocated buffers with external input. |
| CWE-15 | Unrestricted file upload — CWE-434 | 2 | Critical | Check file upload handlers for type validation, size limits, storage location. |
| CWE-16 | Heap buffer overflow — CWE-122 | 5 | Critical | Review C extensions for heap-allocated buffer overflows. |
| CWE-17 | Missing auth for critical function — CWE-306 | 2 | Critical | Check admin, config, and data-destructive endpoints for authentication requirements. |
| CWE-18 | Deserialization of untrusted data — CWE-502 | 1 | Critical | Check for pickle.loads, yaml.load, jsonpickle.decode with external input. |
| CWE-19 | Improper access control — CWE-284 | 2 | High | Review resource access patterns for consistent authorization checks. |
| CWE-20 | Auth bypass via user-controlled key — CWE-639 | 3 | High | Check for user-supplied IDs used in authorization decisions without ownership verification. |
| CWE-21 | Uncontrolled resource allocation — CWE-770 | 3 | High | Check for unbounded memory allocation, file handle creation, connection pooling from user input. |
| CWE-22 | Server-side request forgery — CWE-918 | 2 | High | Check for user-supplied URLs passed to HTTP clients, DNS resolution, or file fetchers. |
| CWE-23 | NULL pointer dereference — CWE-476 | 5 | Medium | Review C extensions for unchecked pointer returns from allocation or lookup functions. |
| CWE-24 | Integer overflow — CWE-190 | 5 | High | Review arithmetic on user-controlled integers, especially in size calculations or loop bounds. |
| CWE-25 | Command injection — CWE-77 | 0 | Critical | (See INJ-02) |

---

## Domain 5: SANS/Historical (6 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| SANS-01 | Improper input validation | 1 | High | Check all external input entry points for type, range, length, and format validation. |
| SANS-02 | XML External Entity (XXE) | 2 | High | Check XML parsers for external entity processing. Verify `defusedxml` usage or entity expansion disabled. |
| SANS-03 | Uncontrolled resource consumption | 3 | High | Check for missing timeouts, unbounded loops, and unlimited allocations on user-controlled input. |
| SANS-04 | Hardcoded credentials | 0 | Critical | (See CRED-01) |
| SANS-05 | Insufficiently protected credentials | 2 | High | Check for credentials transmitted in plain text, stored with reversible encoding, or weakly hashed. |
| SANS-06 | Missing encryption of sensitive data | 2 | High | Check for sensitive data stored or transmitted without encryption. |

---

## Domain 6: Python-Specific Risks (19 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| PY-01 | Unsafe eval()/exec() | 0 | Critical | Grep for `eval(`, `exec(` in source. Verify no user-controlled input reaches these calls. |
| PY-02 | Insecure pickle deserialization | 0 | Critical | Grep for `pickle.loads`, `pickle.load` with untrusted input. Verify safe alternatives used. |
| PY-03 | YAML unsafe load | 0 | Critical | Grep for `yaml.load(` without `Loader=SafeLoader`. Verify `yaml.safe_load()` used instead. |
| PY-04 | subprocess shell=True injection | 0 | Critical | Grep for `subprocess.*shell=True` with user input. Verify `shell=False` and list args. |
| PY-05 | Tarfile path traversal (CVE-2007-4559) | 1 | High | Check `tarfile.extractall()` on untrusted archives. Verify member path validation. |
| PY-06 | Zipfile infinite loop | 3 | Medium | Check `zipfile.Path` methods on untrusted archives. |
| PY-07 | xml.etree XXE vulnerability | 2 | High | Check for `xml.etree.ElementTree` parsing untrusted XML. Verify `defusedxml` used. |
| PY-08 | http.cookies quadratic complexity | 3 | Medium | Check cookie parsing with untrusted input for DoS potential. |
| PY-09 | html.parser quadratic complexity | 3 | Medium | Check `HTMLParser` with untrusted malformed HTML input. |
| PY-10 | tempfile race conditions | 1 | Medium | Check for `tempfile.mktemp()` (deprecated). Verify `tempfile.mkstemp()` or `NamedTemporaryFile`. |
| PY-11 | ReDoS — regular expression denial of service | 2 | Medium | Review regex patterns with nested quantifiers on user-controlled input. |
| PY-12 | assert statements in production | 1 | Medium | Check for `assert` used for input validation or security checks (stripped with `-O`). |
| PY-13 | Mutable default arguments | 1 | Low | Check function signatures for `def f(x=[])` or `def f(x={})` patterns. |
| PY-14 | __import__ with user input | 1 | High | Grep for `__import__` or `importlib.import_module` with user-controlled module names. |
| PY-15 | Insecure random number generation | 2 | High | Check for `random.random()`, `random.randint()` used for tokens/secrets. Verify `secrets` module. |
| PY-16 | f-string/format injection | 2 | Medium | Check for user input in f-strings or `.format()` calls that could leak object attributes. |
| PY-17 | GIL-related concurrency bugs | 3 | Medium | Check for shared mutable state in threaded code assuming GIL atomicity on compound operations. |
| PY-18 | Unvalidated pip install from URLs | 1 | High | Check for `pip install` from arbitrary URLs or git repos without hash verification. |
| PY-19 | jsonpickle deserialization RCE | 0 | Critical | Grep for `jsonpickle.decode` with untrusted input. Same risk profile as pickle. |

---

## Domain 7: Supply Chain Risks (15 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| SC-01 | Dependency confusion | 4 | Critical | Check for internal package names that conflict with public registry names. Review pip index configuration. |
| SC-02 | Typosquatting | 1 | High | Review dependency names for common misspellings. Cross-reference against known typosquatting databases. |
| SC-03 | Compromised maintainer account | 4 | Critical | Monitor dependency update advisories. Use lockfiles with hashes. |
| SC-04 | Malicious package with legitimate name | 4 | Critical | Verify package provenance. Check download counts, maintainer history. |
| SC-05 | Install-time code execution | 4 | Critical | Review `setup.py` of dependencies for post-install scripts. Prefer wheel installations. |
| SC-06 | Protestware/sabotageware | 4 | High | Monitor dependency changelogs for unusual updates. Pin versions. |
| SC-07 | Self-propagating package worms | 4 | Critical | Review CI/CD token scopes. Limit publish permissions. |
| SC-08 | Pinned version with known CVE | 2 | High | Run `pip-audit` or equivalent. Check lockfile versions against vulnerability databases. |
| SC-09 | Transitive dependency vulnerability | 2 | High | Run `pip-audit` with `--desc`. Review dependency tree for deep vulnerabilities. |
| SC-10 | Abandoned/unmaintained dependency | 4 | Medium | Check last release date, open issues, maintainer activity for critical dependencies. |
| SC-11 | License incompatibility | 4 | Medium | Run license checker. Verify compatibility with project license. |
| SC-12 | Dependency with excessive permissions | 4 | High | Review dependency capabilities (filesystem, network, env var access). |
| SC-13 | Star jacking/reputation hijacking | 4 | Medium | Verify package repository links match actual source. |
| SC-14 | Build tool compromise | 4 | Critical | Verify build tool integrity. Pin build tool versions. |
| SC-15 | Registry poisoning | 5 | Critical | Use private registry mirrors. Verify package signatures where available. |

---

## Domain 8: Infrastructure/Deployment Risks (12 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| INFRA-01 | Publicly exposed storage buckets | 4 | Critical | Review cloud storage configuration for public access ACLs. |
| INFRA-02 | Exposed database ports | 4 | Critical | Check network configuration for database ports open to internet. |
| INFRA-03 | Debug mode in production | 0 | Critical | Grep for `DEBUG=True`, `debug=True`, `FLASK_DEBUG=1` in production config. |
| INFRA-04 | Missing WAF/rate limiting | 4 | High | Review infrastructure for rate limiting configuration at edge. |
| INFRA-05 | Unpatched server OS/runtime | 4 | High | Check Dockerfile base images for latest patches. Review runtime versions. |
| INFRA-06 | Exposed admin interfaces | 4 | Critical | Check for admin panels accessible without VPN/IP restriction. |
| INFRA-07 | Misconfigured IAM policies | 4 | High | Review cloud IAM for principle of least privilege. Check for wildcard permissions. |
| INFRA-08 | Missing network segmentation | 4 | High | Review network architecture for service isolation. |
| INFRA-09 | Insecure container configuration | 4 | High | Check Dockerfiles for `USER root`, `--privileged`, host network mode. |
| INFRA-10 | Exposed Kubernetes API | 4 | Critical | Check K8s API server authentication and network exposure. |
| INFRA-11 | Missing TLS termination | 4 | Medium | Check internal service communication for encryption. |
| INFRA-12 | Cloud metadata service exposure | 4 | Critical | Check for SSRF paths that could reach 169.254.169.254. |

---

## Domain 9: Code Quality Risks (14 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| QUAL-01 | High cyclomatic complexity | 2 | Medium | Run complexity analysis. Check for functions with >15 branches. |
| QUAL-02 | Dead/unreachable code | 2 | Low | Run linter for unused imports, unreachable code after return/raise. |
| QUAL-03 | Code duplication | 2 | Medium | Check for repeated logic >10 lines that should be extracted. |
| QUAL-04 | Missing function/module docstrings | 2 | Low | Run AST-based docstring check on public functions. |
| QUAL-05 | God classes/functions | 2 | Medium | Check for functions >100 lines or classes with >15 methods. |
| QUAL-06 | Tight coupling | 3 | Medium | Review import graphs for circular or excessive dependencies. |
| QUAL-07 | Premature optimization | 2 | Low | Check for complexity introduced without measured performance need. |
| QUAL-08 | Magic numbers/strings | 2 | Low | Check for unexplained literal values in logic. Verify constants defined. |
| QUAL-09 | Inconsistent error handling patterns | 2 | Medium | Check for mixed exception/return-code/silent-error patterns. |
| QUAL-10 | Missing type hints | 3 | Low | Check public function signatures for type annotations. |
| QUAL-11 | Circular imports/dependencies | 2 | Medium | Check for circular import patterns in module graph. |
| QUAL-12 | Technical debt accumulation | 3 | Medium | Review for TODO/FIXME comments in production code paths. |
| QUAL-13 | Commented-out code | 2 | Low | Check for blocks of commented-out code that should be removed. |
| QUAL-14 | Inconsistent naming conventions | 2 | Low | Check for mixed camelCase/snake_case within same module. |

---

## Domain 10: Data Handling Risks (10 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| DATA-01 | PII exposure in logs/responses | 2 | High | Check logging calls and API responses for email, SSN, phone, address patterns. |
| DATA-02 | Mass assignment/over-posting | 2 | High | Check for `**kwargs` or `request.data` bound directly to models without field filtering. |
| DATA-03 | Improper output sanitization | 1 | High | Check output encoding for context (HTML, JSON, SQL, shell). |
| DATA-04 | Insecure direct object reference (IDOR) | 2 | High | Check for database IDs in URLs/params without ownership verification. |
| DATA-05 | Data retention beyond necessity | 4 | Medium | Review data storage for retention policies. Check for GDPR compliance where applicable. |
| DATA-06 | Unencrypted database fields | 4 | High | Check for sensitive data (SSN, credit card) stored without field-level encryption. |
| DATA-07 | Improper data masking | 4 | Medium | Check non-production environments and exports for unmasked sensitive data. |
| DATA-08 | CSV/formula injection | 3 | Medium | Check CSV export for user data with `=`, `+`, `-`, `@` prefix escaping. |
| DATA-09 | Unicode normalization issues | 3 | Medium | Check input validation for Unicode bypass (different representations of same char). |
| DATA-10 | Unvalidated redirects/forwards | 2 | Medium | Check redirect URLs derived from user input for open redirect vulnerability. |

---

## Domain 11: Authentication/Authorization Risks (12 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| AUTH-01 | Credential stuffing | 3 | High | Check for rate limiting on login endpoints. Verify account lockout policies. |
| AUTH-02 | Brute force without lockout | 2 | High | Check login endpoints for attempt rate limiting and lockout mechanisms. |
| AUTH-03 | Missing multi-factor authentication | 4 | High | Check critical systems for MFA enforcement on admin/privileged accounts. |
| AUTH-04 | Session fixation | 3 | High | Check for session regeneration after login. Verify session ID rotation. |
| AUTH-05 | Session not invalidated on logout | 3 | Medium | Check logout handler for server-side session destruction. |
| AUTH-06 | Insecure password recovery | 3 | High | Check reset flow for predictable tokens, information leakage, verification bypass. |
| AUTH-07 | JWT algorithm confusion | 2 | Critical | Check JWT verification for `none` algorithm acceptance, RS256/HS256 confusion. |
| AUTH-08 | Insecure token storage | 3 | Medium | Check for auth tokens in localStorage (XSS-accessible). Prefer httpOnly cookies. |
| AUTH-09 | Broken function-level authorization (BFLA) | 2 | Critical | Check admin/privileged API endpoints for role-based access checks. |
| AUTH-10 | Privilege escalation via parameter tampering | 2 | Critical | Check for modifiable role/permission parameters in requests. |
| AUTH-11 | OAuth misconfiguration | 3 | High | Check OAuth for missing state parameter, broad scopes, insecure redirect URIs. |
| AUTH-12 | Insufficient session expiration | 3 | Medium | Check session timeout configuration. Verify reasonable TTL on tokens. |

---

## Domain 12: Concurrency Risks (10 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| CONC-01 | Race condition (TOCTOU) | 3 | High | Check for check-then-act patterns on shared resources without atomicity. |
| CONC-02 | Deadlock | 3 | High | Check for multiple lock acquisitions in different orders across code paths. |
| CONC-03 | Data race | 3 | High | Check for unsynchronized access to shared mutable state in concurrent code. |
| CONC-04 | Resource starvation | 3 | Medium | Check for unbounded thread/process creation, missing fairness in scheduling. |
| CONC-05 | Livelock | 3 | Medium | Check for retry loops that interact and prevent forward progress. |
| CONC-06 | Atomicity violation | 3 | High | Check for compound read-modify-write operations on shared state without locks. |
| CONC-07 | Priority inversion | 5 | Medium | Check for high-priority threads waiting on resources held by low-priority threads. |
| CONC-08 | Double-checked locking bugs | 3 | Medium | Check lazy initialization patterns for correct volatile/atomic usage. |
| CONC-09 | Connection pool exhaustion | 3 | High | Check database/HTTP connection pools for max size, timeout, leak detection. |
| CONC-10 | File lock contention | 3 | Medium | Check for multiple processes competing for file locks without timeout. |

---

## Domain 13: Error Handling Risks (8 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| ERR-01 | Stack trace exposure | 1 | Medium | Check error responses for full stack traces, file paths, library versions. |
| ERR-02 | Swallowed/silent exceptions | 1 | High | Grep for bare `except: pass`, empty except blocks, catch-and-ignore patterns. |
| ERR-03 | Overly broad exception handling | 1 | Medium | Check for `except Exception` or `except BaseException` without re-raise or specific handling. |
| ERR-04 | Information leakage in errors | 1 | High | Check error messages for database schema, SQL queries, internal paths. |
| ERR-05 | Missing error handling on external calls | 1 | Medium | Check network requests, file ops, API calls for try/except or error checking. |
| ERR-06 | Inconsistent HTTP error codes | 2 | Low | Check for 200 OK returned on error conditions. Verify consistent error format. |
| ERR-07 | Fail-open error handling | 2 | Critical | Check security controls for default-allow on error. Verify fail-closed behavior. |
| ERR-08 | Resource leak on exception | 1 | Medium | Check for file handles, connections, locks not released in exception paths. Verify context managers. |

---

## Domain 14: Logging/Observability Risks (8 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| LOG-01 | Logging sensitive data | 2 | High | Check logging calls for passwords, tokens, PII, credit card numbers. |
| LOG-02 | Insufficient audit logging | 3 | High | Verify logging of login attempts, permission changes, data access, admin actions. |
| LOG-03 | Log injection | 2 | Medium | Check for unsanitized user input in log messages enabling log forging. |
| LOG-04 | Missing correlation IDs | 3 | Medium | Check distributed services for request tracing/correlation ID propagation. |
| LOG-05 | Log files accessible to attackers | 4 | High | Check log file storage location and permissions. Verify not web-accessible. |
| LOG-06 | Excessive logging volume | 3 | Low | Check for debug-level logging in production code paths. |
| LOG-07 | Missing alerting on security events | 4 | High | Check for automated alerts on failed auth, privilege escalation, anomalous access. |
| LOG-08 | Timestamps without timezone | 3 | Low | Check log entries for timezone information. Verify UTC or explicit timezone. |

---

## Domain 15: Testing Risks (10 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| TEST-01 | Insufficient coverage on critical paths | 2 | High | Run coverage on security-critical and business-critical code. Check for untested branches. |
| TEST-02 | Flaky/non-deterministic tests | 2 | Medium | Check test history for intermittent failures. Review time-dependent or order-dependent tests. |
| TEST-03 | Testing implementation instead of behavior | 2 | Medium | Check for tests tightly coupled to internal details that break on refactoring. |
| TEST-04 | Missing negative/error path tests | 2 | High | Check for tests of error conditions, invalid input, boundary values, timeouts. |
| TEST-05 | Test data with real secrets/PII | 0 | High | Check test fixtures for real credentials, email addresses, phone numbers. |
| TEST-06 | Missing security-focused tests | 2 | High | Check for tests of auth bypass, authorization, injection resistance, input validation. |
| TEST-07 | Over-mocking | 2 | Medium | Check for excessive mocking that prevents testing real behavior or integration. |
| TEST-08 | Missing regression tests | 2 | Medium | Check that bug fixes include tests preventing the same bug from reappearing. |
| TEST-09 | Tests that never fail | 2 | Medium | Check for assertions that are trivially true or tests with no assertions. |
| TEST-10 | Test environment drift | 4 | Medium | Compare test environment config with production for significant divergence. |

---

## Domain 16: Configuration Risks (10 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| CONF-01 | Debug mode in production | 0 | Critical | (See INFRA-03) |
| CONF-02 | Default database credentials | 0 | Critical | Check database config for postgres/postgres, root/empty, admin/admin patterns. |
| CONF-03 | Permissive CORS policy | 4 | High | Check for `Access-Control-Allow-Origin: *` with credentials enabled. |
| CONF-04 | Disabled CSRF protection | 2 | High | Check for CSRF middleware disabled or exempt decorators on state-changing endpoints. |
| CONF-05 | Verbose error pages in production | 1 | High | Check for framework debug error pages enabled in production configuration. |
| CONF-06 | Insecure cookie configuration | 3 | Medium | Check for missing Secure, HttpOnly, SameSite attributes on session cookies. |
| CONF-07 | Development dependencies in production | 4 | Medium | Check for debug toolbars, profilers, test frameworks in production deployment. |
| CONF-08 | Misconfigured CSP | 4 | Medium | Check Content-Security-Policy for unsafe-inline, unsafe-eval, overly broad sources. |
| CONF-09 | Missing rate limiting | 2 | High | Check auth endpoints and API routes for rate limiting configuration. |
| CONF-10 | Insecure default config values | 2 | High | Check for SESSION_COOKIE_SECURE=False, ALLOWED_HOSTS=['*'], SECRET_KEY='changeme'. |

---

## Domain 17: API Risks — OWASP API Top 10 (12 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| API-01 | Broken object-level authorization (BOLA) | 2 | Critical | Check API endpoints for object ID verification against requester's permissions. |
| API-02 | Broken authentication (API) | 2 | Critical | Check API auth for weak tokens, missing validation, credential exposure. |
| API-03 | Broken object property-level authorization | 3 | High | Check API responses for excessive data. Check for modification of restricted properties. |
| API-04 | Unrestricted resource consumption | 3 | High | Check for missing pagination, rate limits, request size limits on API endpoints. |
| API-05 | Broken function-level authorization (API) | 2 | Critical | Check admin API functions for role-based access verification. |
| API-06 | Unrestricted access to sensitive business flows | 3 | High | Check business-critical flows for anti-automation controls. |
| API-07 | Server-side request forgery (API) | 2 | High | Check API endpoints that fetch URLs for SSRF protection. |
| API-08 | API security misconfiguration | 4 | Medium | Check for verbose errors, unnecessary HTTP methods, permissive CORS on APIs. |
| API-09 | Improper API inventory management | 4 | Medium | Check for undocumented, deprecated, or shadow APIs still accessible. |
| API-10 | Unsafe consumption of third-party APIs | 3 | Medium | Check for unvalidated data from external APIs used in processing. |
| API-11 | GraphQL introspection in production | 3 | Medium | Check for GraphQL introspection enabled in production environment. |
| API-12 | Missing API versioning strategy | 3 | Medium | Check for breaking API changes without versioning scheme. |

---

## Domain 18: File System Risks (9 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| FS-01 | Path traversal via user input | 1 | High | Check file operations for user-controlled paths. Verify containment within intended directory. |
| FS-02 | Unsafe temporary file creation | 1 | Medium | Check for `tempfile.mktemp()` or predictable temp file names. |
| FS-03 | Symlink following attack | 3 | High | Check file operations for symlink resolution. Verify `os.path.realpath()` before access. |
| FS-04 | Unrestricted file upload size | 2 | Medium | Check upload handlers for file size limits. |
| FS-05 | Unrestricted file upload type | 2 | High | Check upload handlers for content-type validation and extension filtering. |
| FS-06 | Insecure file permissions | 2 | Medium | Check file creation for appropriate permission modes. Verify no world-writable files. |
| FS-07 | Zip bomb/decompression bomb | 3 | Medium | Check archive extraction for decompressed size limits. |
| FS-08 | Directory traversal in archive extraction | 1 | High | Check tar/zip extraction for member path validation against traversal. |
| FS-09 | Unvalidated file content type | 2 | Medium | Check for content-type validation by magic bytes, not just extension or header. |

---

## Domain 19: Serialization Risks (8 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| SER-01 | Python pickle RCE | 0 | Critical | (See PY-02) |
| SER-02 | YAML deserialization RCE | 0 | Critical | (See PY-03) |
| SER-03 | jsonpickle deserialization RCE | 0 | Critical | (See PY-19) |
| SER-04 | shelve module insecurity | 1 | Critical | Check for `shelve.open()` on untrusted data. Shelve uses pickle internally. |
| SER-05 | XXE in deserialization | 2 | High | Check XML parsing for external entity processing during deserialization. |
| SER-06 | Insecure JSON with custom decoders | 3 | High | Check custom JSON decoders for type-hint-based object instantiation from untrusted data. |
| SER-07 | Protocol buffer unknown field handling | 5 | Medium | Check protobuf handling for silent acceptance of unknown fields. |
| SER-08 | Billion laughs / XML bomb | 2 | High | Check XML parsing for entity expansion limits. Verify `defusedxml` or expansion disabled. |

---

## Domain 20: Dependency Risks (9 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| DEP-01 | Known CVE in direct dependencies | 2 | High | Run `pip-audit` or `safety check`. Review output for known vulnerabilities. |
| DEP-02 | Known CVE in transitive dependencies | 2 | High | Run `pip-audit` with full dependency tree. Check indirect dependencies. |
| DEP-03 | Unpinned dependency versions | 1 | Medium | Check `pyproject.toml`/`requirements.txt` for `>=` or `*` specifiers without upper bound. |
| DEP-04 | Outdated dependencies | 3 | Medium | Check dependency versions against latest releases. Flag >6 months behind. |
| DEP-05 | License compliance violation | 4 | Medium | Run license checker. Verify dependency licenses compatible with project license. |
| DEP-06 | Single-maintainer critical dependencies | 4 | Medium | Review bus-factor risk on critical dependencies. |
| DEP-07 | Version pinning without hash verification | 4 | High | Check lockfile for hash verification. Verify `--require-hashes` or equivalent. |
| DEP-08 | Phantom dependencies | 2 | Medium | Check for imports that work via transitive installation but aren't declared. |
| DEP-09 | Requirements file injection | 1 | High | Check requirements files for malicious URLs, `--index-url`, or `--extra-index-url` directives. |

---

## Domain 21: Git/VCS Risks (11 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| GIT-01 | Secrets in git history | 0 | Critical | (See CRED-02) |
| GIT-02 | Force push data loss | 0 | High | Check for `git push --force` without `--force-with-lease`. Verify branch protection. |
| GIT-03 | git push --mirror overwrite | 0 | Critical | Check for `--mirror` flag in push commands. |
| GIT-04 | Missing branch protection | 1 | High | Check GitHub settings for branch protection on main/master. |
| GIT-05 | Unsigned commits | 5 | Medium | Check for GPG/SSH signature enforcement on commits. |
| GIT-06 | .gitignore gaps | 1 | Medium | Check .gitignore for `.env*`, `__pycache__`, `.pyc`, IDE configs, OS files. |
| GIT-07 | Large binary files in repository | 2 | Medium | Check for binary files >1MB committed to repository. |
| GIT-08 | Sensitive data in commit messages | 2 | Medium | Review recent commit messages for passwords, tokens, internal URLs. |
| GIT-09 | Leaked private repository access | 0 | Critical | Check for SSH keys or PATs committed to any repository. |
| GIT-10 | Merge conflict resolution errors | 2 | High | Review merge conflict resolutions for logic errors or reverted security fixes. |
| GIT-11 | Git hook bypass (--no-verify) | 1 | Medium | Check for `--no-verify` in scripts or CI. Verify hooks are not bypassed. |

---

## Domain 22: Build/CI Risks — OWASP CI/CD Top 10 (14 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| CI-01 | Insufficient flow control mechanisms | 4 | High | Check CI/CD for required approvals, reviews, quality gates before production. |
| CI-02 | Inadequate identity and access management | 4 | High | Check CI/CD user accounts and service identities for least privilege. |
| CI-03 | Dependency chain abuse in CI/CD | 4 | Critical | Check CI dependency installation for registry verification and lockfile usage. |
| CI-04 | Poisoned pipeline execution (PPE) | 4 | Critical | Check for workflow file modification in PRs. Verify protected pipeline definitions. |
| CI-05 | Insufficient pipeline-based access control | 4 | High | Check CI jobs for overly broad repository/environment access. |
| CI-06 | Insufficient credential hygiene in CI/CD | 4 | Critical | Check for secrets in CI logs, accessible to untrusted code, or stored insecurely. |
| CI-07 | Insecure CI/CD system configuration | 4 | High | Check CI system for outdated versions, default settings, unnecessary plugins. |
| CI-08 | Ungoverned third-party service access | 4 | High | Check third-party CI integrations for excessive permissions. |
| CI-09 | Improper artifact integrity validation | 4 | High | Check build artifacts for signing and verification. |
| CI-10 | Insufficient CI/CD logging | 4 | Medium | Check for audit logs of CI/CD operations. |
| CI-11 | GitHub Actions script injection | 4 | Critical | Check workflow files for `${{ github.event.* }}` in `run:` commands without sanitization. |
| CI-12 | Cached dependency poisoning | 4 | High | Check CI cache configuration for isolation between jobs/branches. |
| CI-13 | Build environment contamination | 4 | High | Check for shared runners where one job can affect another. |
| CI-14 | Insecure self-hosted runners | 4 | High | Check self-hosted runner security: isolation, updates, access control. |

---

## Domain 23: Cross-Cutting Risks (22 risks)

| ID | Risk | Tier | Severity | Check Method |
|---|---|---|---|---|
| CROSS-01 | Algorithmic complexity DoS | 3 | High | Check for hash collision, regex backtracking, sort degradation on user input. |
| CROSS-02 | Improper certificate validation | 4 | High | Check for `verify=False` in HTTP clients, disabled SSL verification. |
| CROSS-03 | DNS rebinding | 4 | High | Check for DNS-based access controls without rebinding protection. |
| CROSS-04 | Clickjacking | 4 | Medium | Check for missing X-Frame-Options or CSP frame-ancestors header. |
| CROSS-05 | HTTP request smuggling | 5 | High | Check for front-end/back-end HTTP parsing discrepancies. |
| CROSS-06 | WebSocket security issues | 3 | Medium | Check WebSocket connections for auth, authorization, origin validation. |
| CROSS-07 | Subdomain takeover | 4 | High | Check DNS records for dangling CNAME to deprovisioned services. |
| CROSS-08 | Open redirect | 2 | Medium | Check redirect endpoints for user-controlled destination URLs. |
| CROSS-09 | Timing side-channel attacks | 3 | Medium | Check password/token comparison for constant-time operations. |
| CROSS-10 | Insufficient entropy in token generation | 2 | High | Check token/session ID generation for `secrets` module or equivalent CSPRNG. |
| CROSS-11 | Business logic flaws | 3 | High | Check for logical abuse: negative quantities, coupon stacking, race conditions in payments. |
| CROSS-12 | Prototype pollution (JavaScript) | 4 | High | Check for Object.prototype modification from user input in JS code. |
| CROSS-13 | ReDoS | 2 | Medium | (See PY-11) |
| CROSS-14 | Integer overflow leading to buffer overflow | 5 | Critical | Check arithmetic on size calculations in native extensions. |
| CROSS-15 | Uncontrolled format string | 5 | Critical | Check for user input used as format string in C extensions. |
| CROSS-16 | Missing Secure flag on cookies | 3 | Medium | Check cookie configuration for Secure attribute. |
| CROSS-17 | Unicode/encoding handling | 3 | Medium | Check for encoding mismatches that could bypass input filters. |
| CROSS-18 | Insufficient backup and recovery | 4 | High | Check for backup procedures on critical data. |
| CROSS-19 | Missing Content-Type validation | 3 | Medium | Check API endpoints for Content-Type header validation. |
| CROSS-20 | Unsafe reflection | 3 | High | Check for user input determining class instantiation or method invocation. |
| CROSS-21 | Improper cleanup on exception | 1 | Medium | Check for resource cleanup in exception paths (temp files, connections, locks). |
| CROSS-22 | Improper authentication (A07:2025) | 2 | Critical | Check auth mechanisms: weak passwords, credential stuffing, session exposure. |

---

# Part B: AI-Specific Risks (73 risks)

These risks are **always enforced regardless of project phase** because they are introduced by the AI development tool itself, not by the project's maturity.

---

## AI Domain 1: Hallucination and Fabrication (6 risks)

| ID | Risk | Severity | Check Method |
|---|---|---|---|
| AI-HAL-01 | Hallucinated API calls | Critical | Verify all function/method calls exist in the target library. Check imports against installed packages. |
| AI-HAL-02 | Hallucinated package imports | Critical | Verify all imported packages exist on PyPI/npm. Cross-check with pyproject.toml dependencies. |
| AI-HAL-03 | Slopsquatting supply chain attack | Critical | Verify suggested packages against known hallucination patterns. Check download counts and maintainer history. |
| AI-HAL-04 | Fabricated configuration options | High | Verify config keys, env variables, CLI flags exist in target tool documentation. |
| AI-HAL-05 | Invented error codes and constants | High | Verify error codes, status constants, enum values exist in the actual API. |
| AI-HAL-06 | Phantom documentation references | Medium | Verify cited documentation pages, RFC numbers, specification sections actually exist. |

---

## AI Domain 2: Outdated and Deprecated Patterns (5 risks)

| ID | Risk | Severity | Check Method |
|---|---|---|---|
| AI-DEP-01 | Deprecated API usage | High | Check if suggested APIs have deprecation notices. Verify against current library docs. |
| AI-DEP-02 | Vulnerable dependency versions | Critical | Check suggested dependency versions against CVE databases. Run pip-audit. |
| AI-DEP-03 | Outdated language idioms | Medium | Check for Python 2 idioms, old-style string formatting, deprecated stdlib usage. |
| AI-DEP-04 | Training data staleness | High | Check if patterns reference features/APIs from >2 years ago without current verification. |
| AI-DEP-05 | Deprecated security primitives | Critical | Check for MD5, SHA-1 for passwords, DES, RC4, or other deprecated crypto. |

---

## AI Domain 3: Security Vulnerabilities in Generated Code (10 risks)

| ID | Risk | Severity | Check Method |
|---|---|---|---|
| AI-SEC-01 | SQL injection in generated code | Critical | Check all database queries for parameterization. No string concatenation in SQL. |
| AI-SEC-02 | XSS in generated code | Critical | Check all HTML output for proper escaping. Verify template autoescape. |
| AI-SEC-03 | Log injection in generated code | High | Check logging calls for sanitized input. No raw user data in log messages. |
| AI-SEC-04 | Insecure-by-default generation | Critical | Check if AI chose the insecure method when a secure alternative exists. |
| AI-SEC-05 | Hardcoded secrets in generated code | Critical | Check for placeholder credentials that look real. No "changeme", "password123", or real-looking API keys. |
| AI-SEC-06 | Missing input validation in generated code | High | Check all endpoints and functions accepting external input for validation. |
| AI-SEC-07 | Insecure deserialization in generated code | High | Check for pickle, eval, yaml.load without SafeLoader in generated code. |
| AI-SEC-08 | Path traversal in generated code | High | Check file operations for user-controlled paths without containment. |
| AI-SEC-09 | Missing auth in generated code | Critical | Check generated API routes for authentication and authorization checks. |
| AI-SEC-10 | Insecure randomness in generated code | High | Check for random module used for security-sensitive operations. |

---

## AI Domain 4: Prompt Injection and AI Manipulation (6 risks)

| ID | Risk | Severity | Check Method |
|---|---|---|---|
| AI-PI-01 | Direct prompt injection | Critical | Check code that passes user input to LLM calls for injection sanitization. |
| AI-PI-02 | Indirect prompt injection via code comments | Critical | Review code comments, docstrings, README for hidden instructions. Check for invisible Unicode. |
| AI-PI-03 | Rules file backdoor | Critical | Check .cursorrules, .github/copilot-instructions.md, CLAUDE.md for invisible Unicode or hidden instructions. |
| AI-PI-04 | Indirect injection via issues/tickets | Critical | Check code that processes external text (issues, tickets) and passes to AI agents. |
| AI-PI-05 | Agent goal hijacking | Critical | Check AI agent inputs (emails, documents, web content) for instruction injection vectors. |
| AI-PI-06 | Unicode/bidirectional text obfuscation | High | Check for zero-width joiners, bidirectional markers, invisible Unicode in source and config files. |

---

## AI Domain 5: Trust Boundary Violations (8 risks)

| ID | Risk | Severity | Check Method |
|---|---|---|---|
| AI-TRUST-01 | Confused deputy attack | Critical | Check AI agent permissions vs intended operations. Verify agent cannot act on behalf of attacker. |
| AI-TRUST-02 | Data exfiltration via tool invocation | Critical | Check AI tool inputs (URLs, file names, API calls) for encoded sensitive data. |
| AI-TRUST-03 | Excessive agency — functionality | High | Verify AI agent has only the tools needed for its task. No unnecessary capabilities. |
| AI-TRUST-04 | Excessive agency — permissions | High | Verify AI agent operates with minimum required permissions (read-only when possible). |
| AI-TRUST-05 | Excessive agency — autonomy | Critical | Verify human approval checkpoints for critical actions (deploys, deletes, publishes). |
| AI-TRUST-06 | Unintended tool chaining | High | Check for combinations of individually safe tools that create dangerous workflows. |
| AI-TRUST-07 | Semantic privilege escalation | Critical | Check for AI chaining actions across systems to achieve privileges no single user would have. |
| AI-TRUST-08 | Human-agent trust exploitation | High | Check for AI recommendations that require human verification before execution. |

---

## AI Domain 6: Destructive Operations (6 risks)

| ID | Risk | Severity | Check Method |
|---|---|---|---|
| AI-DEST-01 | Unintended file/directory deletion | Critical | Check for rm -rf, rmdir, shutil.rmtree without explicit user confirmation. |
| AI-DEST-02 | Database destruction | Critical | Check for DROP TABLE, TRUNCATE, DELETE without WHERE in generated/executed SQL. |
| AI-DEST-03 | Force push / history rewrite | High | Check for git push --force, git reset --hard without explicit user approval. |
| AI-DEST-04 | Infrastructure delete-and-recreate | Critical | Check for cloud resource deletion as a "fix" strategy. |
| AI-DEST-05 | Reasoning failure in destructive context | Critical | Check if AI has both create and delete permissions — "can" does not mean "should". |
| AI-DEST-06 | Missing human confirmation for writes | High | Check file writes, network calls, deletions for human confirmation prompts. |

---

## AI Domain 7: Code Quality Degradation (13 risks)

| ID | Risk | Severity | Check Method |
|---|---|---|---|
| AI-QUAL-01 | Illusion of correctness | Critical | Verify AI-generated code against specification, not just against "does it run". |
| AI-QUAL-02 | Silent logic errors | High | Check for off-by-one, wrong boundaries, incorrect variable assignments, flawed control flow. |
| AI-QUAL-03 | Missing edge case handling | High | Verify handling of empty inputs, null values, boundary values, concurrent access, timeouts. |
| AI-QUAL-04 | Over-engineering and unnecessary abstraction | Medium | Check for design patterns, interfaces, abstractions not justified by current requirements. |
| AI-QUAL-05 | Boilerplate proliferation | Medium | Check for new utility functions that duplicate existing project utilities. |
| AI-QUAL-06 | Inconsistent patterns within project | Medium | Verify AI-generated code follows project conventions, not generic training patterns. |
| AI-QUAL-07 | Superficial test generation | High | Check tests for meaningful assertions, real behavior verification, not implementation details. |
| AI-QUAL-08 | Tests that verify AI output, not correctness | High | Check if tests verify the code meets the spec, not just that it behaves as-written. |
| AI-QUAL-09 | Tautological assertions | High | Check for assertEqual(True, True), trivially true assertions, tests with no assertions. |
| AI-QUAL-10 | Race conditions in generated code | High | Check generated concurrent code for subtle race conditions and thread-safety issues. |
| AI-QUAL-11 | Performance regressions | Medium | Check for O(n^2) when O(n) exists, excessive memory allocation, unnecessary I/O. |
| AI-QUAL-12 | Error swallowing | High | Check for bare except, catch(Exception) with empty handler, silent continuation on error. |
| AI-QUAL-13 | Technical debt acceleration | High | Verify AI-generated code does not increase misconfigurations or security vulnerabilities. |

---

## AI Domain 8: Documentation and Communication (4 risks)

| ID | Risk | Severity | Check Method |
|---|---|---|---|
| AI-DOC-01 | Subtly incorrect documentation | Medium | Verify generated docstrings match actual function behavior, parameters, and return types. |
| AI-DOC-02 | Confident incorrect explanations | Medium | Verify AI explanations of code behavior against actual implementation. |
| AI-DOC-03 | Stale inline comments | Low | Verify comments match current code behavior. Remove comments that describe deleted functionality. |
| AI-DOC-04 | Misrepresented capabilities | High | Verify claims like "thread-safe", "handles all edge cases" match actual implementation. |

---

## AI Domain 9: Supply Chain and Dependency (5 risks)

| ID | Risk | Severity | Check Method |
|---|---|---|---|
| AI-SC-01 | Malicious AI tool marketplace packages | Critical | Verify AI tool plugins/skills against known malicious package lists. |
| AI-SC-02 | AI-assisted secret extraction | Critical | Check for prompts that could extract memorized credentials from AI training data. |
| AI-SC-03 | License contamination | High | Check AI-generated code for verbatim reproduction of copyrighted code. |
| AI-SC-04 | Dependency confusion via AI | High | Verify AI-suggested packages are the correct public/internal packages. |
| AI-SC-05 | Transitive vulnerability introduction | High | Check AI-suggested dependencies for vulnerable transitive dependencies. |

---

## AI Domain 10: Operational and Organizational (10 risks)

| ID | Risk | Severity | Check Method |
|---|---|---|---|
| AI-OP-01 | Skill atrophy and review degradation | High | Verify code was reviewed by a human who understands it, not rubber-stamped. |
| AI-OP-02 | False confidence in test coverage | High | Verify tests cover meaningful behavior, not just lines. Check mutation testing where applicable. |
| AI-OP-03 | Environment assumption mismatch | Medium | Verify AI-generated code doesn't assume specific OS, runtime, or tool availability. |
| AI-OP-04 | Breaking changes without awareness | High | Check AI modifications for changed function signatures, return types, removed parameters. |
| AI-OP-05 | Cascading failures in multi-agent systems | Critical | Check multi-agent pipelines for error propagation and hallucination cascading. |
| AI-OP-06 | Rogue agent persistence | Critical | Check for AI agents acting beyond session scope or impersonating other agents. |
| AI-OP-07 | Accountability gap | Medium | Verify clear ownership chain from AI suggestion to production deployment. |
| AI-OP-08 | Context window blindness | Medium | Verify AI has seen sufficient context before making architectural changes. |
| AI-OP-09 | Removing safety checks to avoid errors | Critical | Check for AI removing assertions, validation, or safety checks to make code "work". |
| AI-OP-10 | Junior developer pipeline collapse | High | Ensure AI-generated code is understandable and reviewable by the team. |

---

## AI Domain 11: Meta-Assessment Controls (4 risks)

These are self-referential risks designed to prevent the AI from rubber-stamping the risk assessment itself.

| ID | Risk | Severity | Check Method |
|---|---|---|---|
| AI-META-01 | AI produces assessment without reading changed files | Critical | Assessment must reference specific file:line numbers. No blanket "no issues found". |
| AI-META-02 | AI marks all risks as N/A without justification | Critical | Every N/A must include a reason explaining why the risk category doesn't apply. |
| AI-META-03 | AI copies previous assessment without re-evaluating | Critical | Assessment must reference the specific diff for this PR, not generic boilerplate. |
| AI-META-04 | AI evaluates only risks it knows how to find | Critical | Every category in the applicable tier must appear in the output, even if PASS. |

---

# Part C: Summary Statistics

## By Severity

| Severity | General | AI-Specific | Total |
|---|---|---|---|
| Critical | 72 | 28 | 100 |
| High | 118 | 31 | 149 |
| Medium | 85 | 11 | 96 |
| Low | 21 | 1 | 22 |
| **Total** | **296** | **73** | **369** |

## By Tier (General Risks Only)

| Tier | Risks Introduced | Cumulative |
|---|---|---|
| 0 (Always) | 38 | 38 |
| 1 (Prototype) | 32 | 70 |
| 2 (MVP) | 82 | 152 |
| 3 (Alpha) | 63 | 215 |
| 4 (Beta/Pilot) | 60 | 275 |
| 5 (Validation/Production) | 21 | 296 |

AI-specific risks (73) apply at ALL tiers.

## By Domain

| Domain | Count | Primary Tiers |
|---|---|---|
| Secrets/Credentials | 13 | 0, 2, 4 |
| Injection | 12 | 0, 2, 3 |
| OWASP Top 10 | 12 | 1–4 |
| CWE Top 25 | 25 | 0–5 |
| SANS/Historical | 6 | 0–3 |
| Python-Specific | 19 | 0–3 |
| Supply Chain | 15 | 1–5 |
| Infrastructure | 12 | 0, 4 |
| Code Quality | 14 | 2–3 |
| Data Handling | 10 | 1–4 |
| Auth/AuthZ | 12 | 2–4 |
| Concurrency | 10 | 3, 5 |
| Error Handling | 8 | 1–2 |
| Logging/Observability | 8 | 2–4 |
| Testing | 10 | 0, 2, 4 |
| Configuration | 10 | 0–4 |
| API (OWASP API Top 10) | 12 | 2–4 |
| File System | 9 | 1–3 |
| Serialization | 8 | 0–5 |
| Dependency | 9 | 1–4 |
| Git/VCS | 11 | 0–5 |
| Build/CI | 14 | 4 |
| Cross-Cutting | 22 | 1–5 |
| AI: Hallucination | 6 | Always |
| AI: Deprecated Patterns | 5 | Always |
| AI: Security Vulns | 10 | Always |
| AI: Prompt Injection | 6 | Always |
| AI: Trust Boundaries | 8 | Always |
| AI: Destructive Ops | 6 | Always |
| AI: Quality Degradation | 13 | Always |
| AI: Documentation | 4 | Always |
| AI: Supply Chain | 5 | Always |
| AI: Operational | 10 | Always |
| AI: Meta-Assessment | 4 | Always |

---

# Part D: Sources

## Standards and Frameworks

1. [OWASP Top 10:2025](https://owasp.org/Top10/2025/)
2. [OWASP Top 10:2025 — A01 Broken Access Control](https://owasp.org/Top10/2025/A01_2025-Broken_Access_Control/)
3. [OWASP Top 10:2025 — A03 Software Supply Chain Failures](https://owasp.org/Top10/2025/A03_2025-Software_Supply_Chain_Failures/)
4. [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
5. [OWASP Top 10 for LLM Applications 2025](https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/)
6. [OWASP LLM Top 10 — LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
7. [OWASP Top 10 for Agentic Applications 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)
8. [OWASP Top 10 CI/CD Security Risks](https://owasp.org/www-project-top-10-ci-cd-security-risks/)
9. [CWE Top 25 2025 (MITRE)](https://cwe.mitre.org/top25/archive/2025/2025_cwe_top25.html)
10. [2025 CWE Top 25 (CISA)](https://www.cisa.gov/news-events/alerts/2025/12/11/2025-cwe-top-25-most-dangerous-software-weaknesses)
11. [CWE Top 25 2024 (MITRE)](https://cwe.mitre.org/top25/archive/2024/2024_cwe_top25.html)
12. [SANS Top 25 Software Errors](https://www.sans.org/top25-software-errors)
13. [NIST Taxonomy of Software Flaws](https://www.nist.gov/itl/ssd/software-quality-group/taxonomy-software-flaws)
14. [Seven Pernicious Kingdoms (NIST/SAMATE)](https://samate.nist.gov/SSATTM_Content/papers/Seven%20Pernicious%20Kingdoms%20-%20Taxonomy%20of%20Sw%20Security%20Errors%20-%20Tsipenyuk%20-%20Chess%20-%20McGraw.pdf)
15. [OWASP Deserialization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html)

## AI/LLM Security Research

16. [CSA: Understanding Security Risks in AI-Generated Code](https://cloudsecurityalliance.org/blog/2025/07/09/understanding-security-risks-in-ai-generated-code)
17. [Veracode: GenAI Code Security Report](https://www.veracode.com/blog/genai-code-security-report/)
18. [Help Net Security: Nearly half of AI code may be insecure](https://www.helpnetsecurity.com/2025/08/07/create-ai-code-security-risks/)
19. [Georgetown CSET: Cybersecurity Risks of AI-Generated Code](https://cset.georgetown.edu/publication/cybersecurity-risks-of-ai-generated-code/)
20. [USENIX: Package Hallucinations in Code Generation](https://www.usenix.org/publications/loginonline/we-have-package-you-comprehensive-analysis-package-hallucinations-code)
21. [CACM: LLM Hallucinations in Code Generation](https://cacm.acm.org/news/nonsense-and-malicious-packages-llm-hallucinations-in-code-generation/)
22. [ACM: Security Weaknesses of Copilot-Generated Code](https://dl.acm.org/doi/10.1145/3716848)
23. [OWASP LLM Top 10 applied to Code Generation (Sonar)](https://www.sonarsource.com/resources/library/owasp-llm-code-generation/)
24. [arxiv: CodeMirage — Hallucinations in Code Generated by LLMs](https://arxiv.org/html/2408.08333v1)
25. [arxiv: Vibe Coding in Practice — Flow, Technical Debt, and Guidelines](https://arxiv.org/abs/2512.11922)

## Prompt Injection and Agent Security

26. [Pillar Security: Rules File Backdoor](https://www.pillar.security/blog/new-vulnerability-in-github-copilot-and-cursor-how-hackers-can-weaponize-code-agents)
27. [Hacker News: Rules File Backdoor Attack](https://thehackernews.com/2025/03/new-rules-file-backdoor-attack-lets.html)
28. [Microsoft: Defending Against Indirect Prompt Injection](https://www.microsoft.com/en-us/msrc/blog/2025/07/how-microsoft-defends-against-indirect-prompt-injection-attacks)
29. [Google: Mitigating Prompt Injection with Layered Defense](https://security.googleblog.com/2025/06/mitigating-prompt-injection-attacks.html)
30. [Trail of Bits: Prompt Injection Engineering for Attackers](https://blog.trailofbits.com/2025/08/06/prompt-injection-engineering-for-attackers-exploiting-github-copilot/)
31. [SecurityWeek: GitHub Issues Abused in Copilot Attack](https://www.securityweek.com/github-issues-abused-in-copilot-attack-leading-to-repository-takeover/)
32. [Trend Micro: Data Exfiltration via AI Agents](https://www.trendmicro.com/vinfo/us/security/news/threat-landscape/unveiling-ai-agent-vulnerabilities-part-iii-data-exfiltration)

## Destructive AI Incidents

33. [Noma Security: Destructive Capabilities in Agentic AI](https://noma.security/blog/the-risk-of-destructive-capabilities-in-agentic-ai/)
34. [Particula: Amazon Kiro AI Incident](https://particula.tech/blog/ai-agent-production-safety-kiro-incident)
35. [AI Incident Database: Replit Agent Destruction](https://incidentdatabase.ai/cite/1152/)

## AI Code Quality Research

36. [IEEE Spectrum: AI Coding Degrades — Silent Failures](https://spectrum.ieee.org/ai-coding-degrades)
37. [CodeRabbit: AI vs Human Code Gen Report](https://www.coderabbit.ai/blog/state-of-ai-vs-human-code-generation-report)
38. [Dark Reading: AI Agent Security Pitfalls 2026](https://www.darkreading.com/application-security/coders-adopt-ai-agents-security-pitfalls-lurk-2026)
39. [Pixelmojo: AI Technical Debt Crisis 2026-2027](https://www.pixelmojo.io/blogs/vibe-coding-technical-debt-crisis-2026-2027)

## Supply Chain and Dependencies

40. [FOSSA: Slopsquatting Supply Chain Risk](https://fossa.com/blog/slopsquatting-ai-hallucinations-new-software-supply-chain-risk/)
41. [Kaspersky: Vibe Coding Security Risks](https://www.kaspersky.com/blog/vibe-coding-2025-risks/54584/)
42. [SOCRadar: Top 10 Supply Chain Attacks 2025](https://socradar.io/blog/top-10-supply-chain-attacks-2025/)
43. [DeepStrike: Supply Chain Attack Statistics 2025](https://deepstrike.io/blog/supply-chain-attack-statistics-2025)

## Vulnerability Databases and Guides

44. [Aikido: Python Security Vulnerabilities](https://www.aikido.dev/blog/python-security-vulnerabilities)
45. [GuardRails: Python Security Vulnerabilities](https://www.guardrails.io/blog/how-to-detect-and-fix-the-five-most-common-python-security-vulnerabilities/)
46. [Python Security Vulnerabilities Documentation](https://python-security.readthedocs.io/vulnerabilities.html)
47. [Semgrep: Insecure Deserialization in Python](https://semgrep.dev/docs/learn/vulnerabilities/insecure-deserialization/python)
48. [GitGuardian: Leaked Secrets in Code Repositories](https://blog.gitguardian.com/leaked-secrets-in-code-repositories/)

## General Security References

49. [OWASP Top 10 2025 Changes (Equixly)](https://equixly.com/blog/2025/12/01/owasp-top-10-2025-vs-2021/)
50. [OWASP Top 10 2025 Changes (GitLab)](https://about.gitlab.com/blog/2025-owasp-top-10-whats-changed-and-why-it-matters/)
51. [OWASP Top 10 2025 Analysis (Fastly)](https://www.fastly.com/blog/new-2025-owasp-top-10-list-what-changed-what-you-need-to-know)
52. [OWASP Top 10 2025 for Developers (Aikido)](https://www.aikido.dev/blog/owasp-top-10-2025-changes-for-developers)
53. [CWE Top 25 2025 (BleepingComputer)](https://www.bleepingcomputer.com/news/security/mitre-shares-2025s-top-25-most-dangerous-software-weaknesses/)
54. [CWE Top 25 2025 (SecurityWeek)](https://www.securityweek.com/mitre-releases-2025-list-of-top-25-most-dangerous-software-vulnerabilities/)
55. [Obsidian Security: Prompt Injection Attacks 2025](https://www.obsidiansecurity.com/blog/prompt-injection)
56. [Unit42: Code Assistant LLM Risks](https://unit42.paloaltonetworks.com/code-assistant-llms/)
57. [Contrast Security: Vibe Coding Security](https://www.contrastsecurity.com/glossary/vibe-coding)
58. [Wiz: AI Security and Vibe Coding](https://www.wiz.io/academy/ai-security/vibe-coding-security)
59. [Bay Tech: AI Vibe Coding Security Risk](https://www.baytechconsulting.com/blog/ai-vibe-coding-security-risk-2025)
60. [JetBrains: CI/CD Security Risks](https://blog.jetbrains.com/teamcity/2026/03/ci-cd-security-risks/)
61. [Sonar: Technical Debt Types](https://www.sonarsource.com/resources/library/technical-debt/)
62. [IBM: Technical Debt Guide](https://www.ibm.com/think/topics/technical-debt)
63. [arxiv: Developer Perspectives on Licensing and Copyright Issues](https://arxiv.org/html/2411.10877v1)

---

*Registry compiled from 63+ authoritative sources. Last updated: 2026-03-13.*
*This document is the source of truth for risk IDs. Rule files in `.claude/rules/` are derived from this registry.*
