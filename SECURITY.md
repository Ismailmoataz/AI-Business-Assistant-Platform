# Security

## Security model

The primary isolation boundary is the company tenant. Authorization combines a validated bearer JWT with a persisted active user/company, a role (`admin`, `manager`, `employee`), department membership, resource ownership/assignment, and document visibility. The server derives company identity; clients do not select it.

## Implemented controls

- Argon2 password hashing and configurable password-strength validation (default minimum 12 characters plus upper/lowercase, number, and symbol).
- Signed HMAC JWTs with issuer, audience, type, expiry, user, company, role, and unique ID claims.
- Short-lived access tokens (default 15 minutes) and persisted hashed refresh-token IDs with row locking, rotation, reuse prevention, logout revocation, and password-reset revocation.
- Hashed, expiring, one-time password-reset and invitation tokens.
- Tenant-filtered repositories/services and document/vector visibility predicates; conversation ownership checks.
- Staging and production settings validation rejects placeholder or short database, Redis, MinIO, and JWT credentials; wildcard/missing host and CORS policies; insecure cookies; database echo; non-JSON logs; and insecure provider URLs.
- MinIO objects are retrieved only after backend authorization; signed URLs expire in 60–3600 seconds (default 300).
- Document upload size cap (default 25 MiB), MIME allowlist, non-public object keys, soft deletes, activity recording, and sanitized domain/provider errors.
- Compose environment overlays keep data services on an internal network, bind published ports to loopback, require Redis authentication, initialize a private versioned MinIO bucket, run application containers as non-root with read-only filesystems, drop capabilities, set `no-new-privileges`, and gate startup on dependency health and an explicit migration job.
- Trusted-host and explicit CORS middleware, request/correlation IDs, restrictive API response headers, structured logs, dependency health, Prometheus metrics, optional OpenTelemetry export, dependency/SAST/package audits, and release image scanning are configured.
- Swagger/ReDoc disabled in production and password-reset request responses designed to resist account enumeration.

## Sensitive data handling

Never commit `.env`, credentials, bearer/refresh/reset/invitation tokens, document contents, provider payloads, or production database dumps. The tracked `.env.example` must contain placeholders only. Rotate any secret suspected of exposure; revoking refresh tokens does not invalidate already issued access tokens before expiry.

Playwright fixtures and the browser API simulator use generated `.test` identities, synthetic tokens, and synthetic company records only. Never seed browser tests from production exports or route them to a shared or production service.

AI providers receive the assembled system prompt, tenant name, user role, retrieved document text, conversation history when supplied, and the user question. The executive dashboard additionally sends a bounded, tenant- and role-authorized snapshot of KPI totals, current-user work, project health, document processing metadata, recent customer names, and activity summaries to generate its brief; it does not send document contents or create conversation history. Treat provider use as a data-processing boundary and configure it only after organizational privacy/legal review.

## Known limitations requiring deployment controls

- The frontend stores access and refresh tokens in persisted `localStorage` via Zustand, increasing impact of XSS. Backend cookie settings are defined but unused.
- CSRF protections are not applicable to the current bearer-token transport, but rate limiting and brute-force/credential-stuffing controls are not implemented in the application and must be supplied at the edge.
- Upload validation trusts the declared MIME type and parses content; there is no malware scanning, magic-byte verification, quarantine, or decompression-bomb policy.
- Google OAuth is incomplete: state is stored in Redis, but no callback validates/consumes it or exchanges codes.
- Password-reset request creates a token in the service but no email delivery/audit integration exists.
- In-process document background tasks are not durable across process restarts.
- Metrics, traces, structured logs, dependency scanning, SAST, and image scanning are prepared, but no production observability backend, alert routing, DAST, backup encryption, or external key-management integration is selected.
- Activity records cover business/document service mutations, not every authentication/read/AI event.
- Signed URLs expose time-limited direct object access to anyone possessing the URL.

Before internet exposure, place the application behind TLS termination and a restrictive reverse proxy, add rate/abuse controls, move browser authentication to an HttpOnly/Secure cookie design (with CSRF protection where applicable), validate/scan uploads, inject secrets from a managed secret store, connect monitoring/alerts, and automate encrypted backups and restore drills.

## Security review checklist

- Test cross-tenant access for every read, mutation, reference ID, background task, download, and vector query.
- Test all roles and department/owner/assignee visibility paths.
- Confirm logs and errors contain no credentials, raw tokens, document text, or provider authorization headers.
- Review migrations for constraint/index/foreign-key changes and ensure soft-deleted records remain excluded.
- Pin/review dependency updates and scan the built images and npm lockfile.
- Verify production secrets are unique, at least 32 random characters where enforced, and rotated through an external secret store.

## Reporting a vulnerability

Do not open a public issue containing exploit details or sensitive data. Contact the repository owner through a private channel and include affected version/commit, reproduction steps, impact, and suggested mitigation. There is no dedicated security contact file or SLA in the current repository.
