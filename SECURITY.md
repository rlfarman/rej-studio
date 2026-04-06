# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in REJ Studio, **please do not file a public issue**. Instead, report it privately so we can address it before disclosure.

**How to report:**

- Use GitHub's [private vulnerability reporting](https://github.com/rlfarman/rej-studio/security/advisories/new) for this repository, **or**
- Email the maintainers listed in [`.github/CODEOWNERS`](./.github/CODEOWNERS).

Please include:

- A description of the issue and its potential impact.
- Steps to reproduce, or a proof-of-concept if available.
- The commit SHA or deployed URL where you observed the issue.

We'll acknowledge your report, investigate, and keep you updated on remediation. Once a fix is released, we're happy to credit you in the advisory if you'd like.

## Scope

In scope:

- The REJ Studio web app (Next.js frontend + server actions).
- The Python optimization backend (FastAPI / Modal).
- Database access patterns and server-side data handling.

Out of scope:

- Vulnerabilities in third-party dependencies — please report those upstream. If a dependency issue materially affects REJ Studio, we'll track it via Dependabot.
- Denial-of-service via expensive optimization jobs (the backend is compute-bounded by design).
- Findings that require a compromised developer machine or stolen credentials.
