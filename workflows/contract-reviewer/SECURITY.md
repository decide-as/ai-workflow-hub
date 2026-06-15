# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |

Only the latest release receives security updates. Users on older versions should upgrade to receive fixes.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not open a public issue.** Security vulnerabilities must be reported privately.
2. **Use GitHub's private vulnerability reporting**: navigate to this repository's Security tab and click "Report a vulnerability."

### What to include

- Description of the vulnerability and its impact
- Steps to reproduce
- Affected versions (if known)
- Suggested fix (if any)

### Response timeline

- **Acknowledgment**: within 48 hours of report
- **Initial assessment**: within 5 business days
- **Fix timeline**: depends on severity — critical issues are prioritized for the next release

## Scope

The following are in scope for security reports:

- Vulnerabilities in `contract_reviewer` source code
- Secrets or credentials accidentally included in the repository
- Subprocess injection or command execution vulnerabilities
- Dependency vulnerabilities in direct dependencies

The following are out of scope:

- Vulnerabilities in development-only dependencies
- Social engineering or phishing attacks
- Denial of service against the application
