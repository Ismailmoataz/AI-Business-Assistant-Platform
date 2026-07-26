# Architecture Decisions

This log captures decisions inferable from current code. It is descriptive, not a retroactive claim that every decision had a formal review.

## D-001 — Company is the tenant boundary

**Status:** Accepted. **Decision:** Store `company_id` on tenant resources, derive it from authenticated state, and combine it with role/department/ownership rules. **Reason:** The product serves multiple companies in one application/database while preventing caller-selected tenant access. **Consequence:** Every new query, reference, job, vector search, and unique constraint needs explicit tenant review.

## D-002 — Modular monolith and layered backend

**Status:** Accepted. **Decision:** Keep one FastAPI deployment with routes, services, repositories, schemas, and SQLAlchemy models separated by responsibility. **Reason:** Current scope benefits from shared transactions and straightforward local operation while preserving seams for testing/providers. **Consequence:** Layer boundaries are conventions rather than independent service boundaries; long-running work should not live in API processes indefinitely.

## D-003 — Explicit Alembic migrations

**Status:** Accepted. **Decision:** Manage schemas through ordered Alembic revisions and never create tables on application startup. **Reason:** Production schema changes need reviewable, repeatable ordering. **Consequence:** Deployment must run `alembic upgrade head` separately and coordinate migrations with code rollout.

## D-004 — PostgreSQL plus pgvector as one persistence platform

**Status:** Accepted. **Decision:** Store relational records, chunks, conversation history, and searchable embeddings in PostgreSQL/pgvector. **Reason:** Tenant filters and similarity ranking can occur in the same query/transactional data boundary. **Consequence:** SQLite tests cannot validate vector behavior; real PostgreSQL integration tests are required.

## D-005 — MinIO for private versioned document bytes

**Status:** Accepted. **Decision:** Keep file bytes in S3-compatible MinIO and metadata/text/authorization in PostgreSQL. **Reason:** Object storage is better suited to versioned binary content while backend authorization remains authoritative. **Consequence:** Database and object backups/cleanup must be coordinated; signed URLs remain bearer capabilities until expiry.

## D-006 — Short JWT access plus rotating persisted refresh tokens

**Status:** Accepted. **Decision:** Use short-lived signed access JWTs and hashed, stateful refresh-token identifiers with rotation/revocation. **Reason:** Fast bearer validation is combined with controllable long-lived sessions. **Consequence:** Browser localStorage in the current frontend remains an XSS-sensitive compromise; cookie settings are not yet wired.

## D-007 — Soft-delete mutable business/document records

**Status:** Accepted. **Decision:** Tombstone key entities and exclude them from normal queries, while retaining immutable activity/comments/version history. **Reason:** Business data needs recovery/audit continuity. **Consequence:** Every query and uniqueness/reuse policy must intentionally handle deleted records; physical retention is undefined.

## D-008 — Independent AI provider contracts

**Status:** Accepted. **Decision:** Configure chat and embeddings separately behind abstract async interfaces; currently Meta provides chat and OpenAI provides embeddings. **Reason:** Workloads and vendor choices differ and tests need injectible deterministic providers. **Consequence:** Unsupported/unset providers fail at runtime on AI paths; health readiness currently does not probe them.

## D-009 — Retrieval authorization inside similarity SQL

**Status:** Accepted. **Decision:** Filter by company, deletion state, company visibility, owner, and department before vector ranking/limit. **Reason:** Post-filtering a top-k result could leak or omit authorized context. **Consequence:** Authorization changes must be mirrored in document service and vector SQL and covered by integration tests.

## D-010 — In-process document ingestion as the current delivery mechanism

**Status:** Provisional. **Decision:** Schedule FastAPI background tasks that open independent sessions and atomically claim lifecycle states. **Reason:** It provides asynchronous request completion without an additional worker system. **Consequence:** Work is not durable across restarts and is unsuitable for reliable horizontal scaling; a queue is planned hardening.

## D-011 — Next.js client application with shared API client

**Status:** Accepted. **Decision:** Use App Router, strict TypeScript, semantic Tailwind tokens, Radix components, TanStack Query, and Zustand with all requests routed through one refresh-aware fetch client. **Reason:** The stack supports responsive product UI, accessible primitives, cache management, and centralized authentication behavior. **Consequence:** Frontend types must track OpenAPI manually and only auth/dashboard experiences are currently integrated.

## D-012 — Explicit degraded states during incremental frontend delivery

**Status:** Superseded by D-014. **Decision:** The earlier incremental dashboard temporarily used placeholders and suppressed unauthorized activity results. **Reason:** The shell predated the production dashboard integration. **Consequence:** Phase 5E removed this provisional behavior in favor of explicit live-data and restricted states.

## D-013 — OpenAPI is an executable contract

**Status:** Accepted. **Decision:** Generate OpenAPI from typed routes, enrich every operation/media type with deterministic examples, and test schema uniqueness/reference integrity. **Reason:** The backend surface is broader than the current frontend and requires discoverable, machine-readable contracts. **Consequence:** Every route change must preserve documentation metadata and contract tests.

## D-014 — Explicit dashboard states and persisted personalization

**Status:** Accepted. **Decision:** Display only authorized live dashboard values, with explicit skeleton, retry, empty, restricted, AI-generated, and deterministic AI-fallback states; persist layout, order, and collapse preferences in the existing UI store. **Reason:** The primary landing experience must not blur sample data, permission limits, or provider availability with real business results. **Consequence:** New dashboard widgets must join the shared overview/read model or an existing paginated API, preserve server authorization, and define all interaction states before delivery.

## D-015 — Playwright with isolated browser-test workspaces

**Status:** Accepted. **Decision:** Use Playwright for browser E2E, run the real Next.js application against a test-only deterministic API simulator, and seed/clean a unique multi-role, multi-tenant workspace for every test. Run full critical coverage in Chromium with tagged Firefox/WebKit smoke and mobile Chromium projects. **Reason:** The repository needs deterministic, parallel, streaming-capable browser coverage without requiring shared infrastructure or live AI providers in every pull request. **Consequence:** The browser suite validates UI behavior and frontend API contracts but does not replace backend pytest, real PostgreSQL/pgvector integration, or a future deployed full-stack smoke suite.

## D-016 — Immutable images and explicit release migrations

**Status:** Accepted. **Decision:** Build separate multi-stage backend/frontend images, run applications as non-root processes, and execute Alembic through a one-shot release job rather than API startup. **Reason:** Application replicas must start predictably without racing or mutating shared schemas, and releases need independently verifiable artifacts. **Consequence:** Every deployment must run the migration gate once before application rollout and retain compatible prior image digests for rollback.

## D-017 — Vendor-neutral operational telemetry

**Status:** Accepted. **Decision:** Emit structured stdout logs, Prometheus metrics, W3C OpenTelemetry traces over OTLP/HTTP, and request/correlation response headers without selecting a monitoring vendor. **Reason:** Operators need common portable signals while application code must not depend on a hosted telemetry backend. **Consequence:** Deployments must supply collectors, storage, dashboards, alerts, access controls for `/metrics`, and retention policy.

## D-018 — Environment overlays over one runtime topology

**Status:** Accepted. **Decision:** Keep one shared Compose service graph and layer local, development, staging, and production configuration/port policy through explicit override and environment files. **Reason:** Shared definitions reduce drift while production values need stronger validation and narrower exposure. **Consequence:** Release commands must specify the intended override and validated environment file; production remains a hardened single-host/reference topology behind operator-managed TLS ingress.
