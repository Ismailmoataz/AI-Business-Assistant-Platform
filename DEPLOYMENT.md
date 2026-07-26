# Deployment

## Deployment model

The repository supports immutable backend and frontend containers on a local, development, staging, or production Compose target. PostgreSQL/pgvector, authenticated Redis, private versioned MinIO, and the applications use separate edge and internal data networks. pgAdmin is an opt-in administrative profile and is not part of staging or production startup.

The backend image never changes the database schema at startup. `migrate` uses the same immutable backend image and runs Alembic as an explicit release job. `minio-init` idempotently creates the private documents bucket, disables anonymous access, and enables object versioning.

| Artifact | Definition | Runtime |
| --- | --- | --- |
| Backend image | `infrastructure/docker/backend/dockerfile` | Python 3.12, non-root FastAPI/Uvicorn |
| Frontend image | `infrastructure/docker/frontend/dockerfile` | Node 22 LTS, non-root Next.js standalone server |
| Base topology | `docker-compose.yml` | Shared services, health checks, networks, security, volumes |
| Environment targets | `docker-compose.{local,development,staging,production}.yml` | Port exposure, immutable images, restart policy |
| Configuration catalog | `backend/.env.example` | Every supported backend/Compose variable |
| Environment examples | `infrastructure/environments/*.env.example` | Environment-specific required values and policy |

Production ports bind to loopback. Put a separately managed TLS reverse proxy/load balancer in front of ports 3000 and 8000; do not expose PostgreSQL, Redis, MinIO, MinIO Console, pgAdmin, or `/metrics` directly to the internet.

## Configuration and secrets

Create an ignored environment file from the matching example and replace every `CHANGE_ME` value. Do not commit the resulting file. Staging and production should inject the same variables from a managed secret store into a root-readable file on the deployment runner or directly into the orchestrator.

```powershell
Copy-Item infrastructure/environments/production.env.example .env.production
```

`Settings` validates local, development, test, staging, and production separately. Production startup rejects:

- missing, placeholder, short, or known-default database/Redis/MinIO/JWT credentials;
- database SQL echo or non-JSON application logs;
- wildcard/missing trusted hosts and wildcard CORS origins;
- insecure cookies;
- invalid reverse-proxy IP/CIDR allowlists;
- non-HTTPS AI provider base URLs;
- enabled OTLP export without an endpoint;
- selected AI providers without their required credentials/models.

`NEXT_PUBLIC_API_URL` is a frontend build-time value. Build a distinct frontend image for each external API origin or use a stable same-origin ingress contract. `FORWARDED_ALLOW_IPS` must contain only the actual reverse-proxy IPs/subnets; never use `*` in production.

The complete variable catalog and bounds are in `backend/.env.example` and `backend/app/config/settings.py`. Provider payloads, credentials, document text, tokens, and database URLs are intentionally absent from logs and metric labels.

## Local stack

The checked-in local example contains development-only credentials and must never be reused outside a workstation.

```powershell
Copy-Item infrastructure/environments/local.env.example .env.local
$compose = @("--env-file", ".env.local", "-f", "docker-compose.yml", "-f", "docker-compose.local.yml")
docker compose @compose config --quiet
docker compose @compose up -d postgres redis minio
docker compose @compose run --rm minio-init
docker compose @compose run --rm migrate
docker compose @compose up --build -d backend frontend
docker compose @compose ps
```

Add `--profile admin` only when local pgAdmin is required. The local frontend is at `http://127.0.0.1:3000`; API readiness is at `http://127.0.0.1:8000/health/ready`.

## Staging and production release

GitHub Actions provides three workflows:

- `CI` gates backend lint, scoped infrastructure typing, tests, migrations, security checks, frontend lint/typecheck/build, Playwright, and both container builds.
- `Release images` reuses the full CI gate, builds multi-architecture images, publishes immutable SHA/tag references to GHCR with provenance/SBOM attestations, and scans them with Trivy.
- `Deploy release` is manually dispatched into a protected GitHub Environment on a self-hosted Linux deployment runner. It validates configuration, pulls immutable images, provisions MinIO, applies migrations once, rolls out both applications, and verifies readiness.

Configure each GitHub Environment with:

- `APP_ENV_FILE`: absolute path to the ignored environment file on the deployment runner;
- `BACKEND_HEALTH_URL`: loopback or protected ingress URL without `/health/ready`;
- required reviewers and deployment-branch/tag protection.

The self-hosted runner needs Docker Engine/Compose, curl, GHCR reachability, access to the deployment host, and a current Actions Runner compatible with Node 24-based actions.

Manual equivalent:

```bash
export APP_ENV_FILE=/run/secrets/ai-business-assistant/production.env
export BACKEND_IMAGE=ghcr.io/owner/repository-backend:sha-1a2b3c4
export FRONTEND_IMAGE=ghcr.io/owner/repository-frontend:sha-1a2b3c4
docker compose --env-file "$APP_ENV_FILE" -f docker-compose.yml -f docker-compose.production.yml config --quiet
docker compose --env-file "$APP_ENV_FILE" -f docker-compose.yml -f docker-compose.production.yml pull backend frontend
docker compose --env-file "$APP_ENV_FILE" -f docker-compose.yml -f docker-compose.production.yml up -d postgres redis minio
docker compose --env-file "$APP_ENV_FILE" -f docker-compose.yml -f docker-compose.production.yml run --rm minio-init
docker compose --env-file "$APP_ENV_FILE" -f docker-compose.yml -f docker-compose.production.yml run --rm migrate
docker compose --env-file "$APP_ENV_FILE" -f docker-compose.yml -f docker-compose.production.yml up -d --no-build backend frontend
curl --fail http://127.0.0.1:8000/health/ready
```

Do not use `docker compose down -v` during deployment. Named volumes contain persistent business data.

## Health and observability

| Endpoint | Purpose | External calls |
| --- | --- | --- |
| `GET /health/live` | Process liveness/restart decision | None |
| `GET /health/ready` | Traffic readiness | PostgreSQL, Redis, configured MinIO bucket |
| `GET /health` | Backward-compatible readiness alias | Same as `/health/ready` |
| `GET /metrics` | Prometheus exposition; omitted from OpenAPI | None |

Every HTTP response includes `X-Request-ID` and `X-Correlation-ID`. Valid incoming values propagate; invalid/missing values are regenerated. JSON stdout logs include both IDs and the OpenTelemetry trace ID without request bodies or credentials. Request, dependency, AI attempt, retry, failover, and latency metrics use bounded labels.

Set `METRICS_BEARER_TOKEN` when the internal monitoring network is not the only access control. Configure Prometheus to send `Authorization: Bearer <token>`. If telemetry is enabled, set `OTEL_ENABLED=true` and `OTEL_EXPORTER_OTLP_ENDPOINT` to a vendor-neutral OpenTelemetry Collector OTLP/HTTP endpoint. The API appends `/v1/traces` when absent.

AI health is intentionally excluded from readiness to avoid billable probes and to keep the dashboard's live-data fallback available during provider incidents. Alert on provider error/retry/failover metrics and user-visible AI failures instead.

## Migration and upgrade procedure

1. Confirm CI and image security scans passed for the exact release commit.
2. Read every migration between the deployed revision and target head; identify locks, data rewrites, and backward-compatibility constraints.
3. Back up PostgreSQL and MinIO as one recovery point and verify the artifacts are readable.
4. Deploy backward-compatible schema changes before code that requires them. Run `migrate` exactly once.
5. Confirm `alembic current` reports the expected head (`20260726_0010` at this repository state).
6. Roll out backend and frontend images by immutable digest/SHA tag.
7. Verify liveness, readiness, authentication/refresh, one authorized business read, upload/download, and configured AI paths.
8. Monitor errors, latency, dependency health, document failures, and resource saturation through at least one normal workload window.

For a PostgreSQL major, pgvector, Redis, MinIO, Python, Node, or base-image upgrade, test backup restore and the entire CI/deployed smoke suite in staging first. Never use MinIO's in-container self-update; replace the pinned image deliberately.

## Backup readiness

Define organization-specific RPO, RTO, retention, encryption, and off-site replication before launch. At minimum:

- PostgreSQL: scheduled encrypted `pg_dump --format=custom` plus storage-level snapshots/WAL archiving appropriate to the RPO.
- MinIO: version-aware `mc mirror --versions` or replication to an independent encrypted bucket/site.
- Redis: AOF is enabled for local Compose resilience, but OAuth state is transient; Redis is not a substitute for PostgreSQL/MinIO backup.
- Configuration: encrypted export of environment/secret-manager metadata, TLS/ingress configuration, image digests, and the deployed Alembic revision.

Database and object backups must share a recovery-point identifier because document metadata and bytes are coordinated across systems. Store checksums and immutable retention metadata with every backup. A backup is not accepted until an isolated restore drill verifies:

1. PostgreSQL restores and `alembic current` is known.
2. The MinIO bucket and versions restore without public access.
3. Readiness passes.
4. Tenant-authorized document download and a representative vector retrieval succeed.

Never test restores against a shared or production database.

## Rollback

Retain the previous backend/frontend image digests and pre-release backup recovery-point ID.

For an application-only regression with a backward-compatible schema:

1. Set `BACKEND_IMAGE` and `FRONTEND_IMAGE` to the previous immutable references.
2. Re-run `docker compose ... up -d --no-build backend frontend`.
3. Verify `/health/ready` and the release smoke checks.

For a schema regression, stop and assess the migration. Use `alembic downgrade <revision>` only when the reviewed downgrade is data-safe and compatible with the restored application. Otherwise restore the coordinated PostgreSQL/MinIO recovery point into a clean environment, validate it, then cut traffic over. Never assume a data migration can be reversed safely.

Record the incident timeline, release/image/migration identifiers, recovery point, tenant impact, and validation evidence.

## Disaster recovery

1. Declare the incident and prevent writes to the damaged environment.
2. Provision clean infrastructure in the approved recovery region/site.
3. Restore secrets/configuration, PostgreSQL, and MinIO from the same recovery point.
4. Restore or recreate Redis; transient OAuth state may be discarded.
5. Deploy the matching immutable application images.
6. Run migrations only to the revision required by those images.
7. Verify health, authentication, tenant isolation, downloads, and retrieval before changing DNS/ingress.
8. Monitor and reconcile records created near the recovery boundary.

Schedule restore drills and document measured RPO/RTO. Backups, TLS certificates, DNS, external secret managers, alert routing, and cross-site infrastructure remain operator-managed because the repository does not define a cloud provider.

## Scaling limitations

API containers are stateless with shared PostgreSQL, Redis, and MinIO, but document ingestion still uses in-process FastAPI background tasks. Do not horizontally scale the API for reliable ingestion until that workflow moves to a durable queue. The Compose target is a hardened single-host/reference deployment, not a substitute for managed HA PostgreSQL/object storage, multi-zone scheduling, autoscaling, or organization-specific ingress.
