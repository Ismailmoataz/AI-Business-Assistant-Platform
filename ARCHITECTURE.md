# Architecture

## System context

The system is a modular monolith with a separate browser frontend. FastAPI exposes all business and AI capabilities; PostgreSQL is the system of record; pgvector supports semantic retrieval; MinIO stores original/versioned files; Redis currently stores short-lived Google OAuth state. External Meta and OpenAI APIs provide chat completion and embeddings respectively.

```text
Browser / Next.js (Orbit)
        |
        | JSON, multipart, bearer JWT, SSE
        v
FastAPI routes -> auth dependencies -> domain/orchestration services
        |                                  |
        v                                  v
 repositories / SQLAlchemy          provider interfaces
        |                             |             |
 PostgreSQL + pgvector             Meta chat   OpenAI embeddings
        |
        +---- MinIO (document bytes)
        +---- Redis (OAuth state)
```

Compose now builds and runs both the backend and a standalone Next.js frontend image. `NEXT_PUBLIC_API_URL` remains a frontend build-time contract and must match the environment's externally reachable API origin.

## Backend layers

1. **API:** `app/main.py` assembles routers. Route modules validate inputs, inject the SQLAlchemy session/current user, map domain exceptions, and shape responses.
2. **Security dependencies:** bearer JWTs are decoded and reconciled with the persisted active user, company, and role. Role factories provide admin and manager/admin guards.
3. **Services:** identity, company, business, document, ingestion, conversation, retrieval, prompt, chat, and executive-dashboard services hold workflow and authorization policy. Dashboard orchestration builds a bounded live snapshot and calls the existing chat-provider interface without creating conversation history.
4. **Repositories:** focused SQLAlchemy/SQL queries encapsulate persistence. The vector repository performs tenant and visibility filtering inside the similarity query; the dashboard read repository applies the existing tenant, role, assignment, department, ownership, and document-visibility scopes before aggregation and limits.
5. **Models/migrations:** SQLAlchemy models represent current behavior; ten sequential Alembic revisions create identity, business, documents, pgvector storage, processing lifecycle, conversations, the task review workflow state, additive customer/note/document business relationships, and composite production query indexes.
6. **Providers:** abstract chat and embedding contracts isolate vendor calls. Current concrete choices are Meta chat and OpenAI embeddings. Shared bounded HTTP pools provide timeouts, retry/backoff for transient transport/408/429/5xx failures, safe metrics/traces, and optional Meta fallback-model failover before response output starts.

Sessions are synchronous SQLAlchemy sessions. Async routes are used where file I/O/provider calls/streaming require them. Schema creation is never automatic at startup.

## Frontend architecture

The frontend uses Next.js App Router, React, strict TypeScript, Tailwind CSS tokens, Radix primitives, TanStack Query, Zustand persistence, React Hook Form/Zod, Framer Motion, and Sonner. Route groups separate authentication from dashboard layout. A shared fetch client adds bearer credentials, coalesces refresh requests, retries once after a successful refresh, and clears invalid sessions.

The current UI has pages for authentication, dashboard, `/assistant`, `/documents`, and protected Projects, Tasks, Employees, Customers, Notes, and Tags workspaces with detail routes. The executive dashboard uses one shared overview query for authorized company context, KPIs, work, and bounded widget data plus the existing paginated activity API, lazy-loads its activity renderer, and persists widget order, collapsed state, and preferred density in the existing UI store. Role-aware quick actions navigate into the established workspaces rather than duplicating their workflows. Documents use TanStack Query for server search, folder data, favorites, recents, versions, and processing polling. Business workspaces share typed query keys, validated dialogs, status/tag controls, exact-entity activity, responsive cards/tables, and debounced server search. The top-bar command search fans out to tenant-authorized employee, customer, project, task, and note endpoints and tolerates role-restricted result groups.

The browser-test layer uses Playwright against the real Next.js application and a test-only Node API simulator. An automatic fixture creates a unique seeded workspace and synthetic session for each test, including multiple roles and tenants, then deletes it after the test. No test endpoint or fixture data is included in the production application/API. Chromium runs the complete journey suite; tagged Firefox/WebKit projects provide cross-browser smoke coverage and a mobile Chromium project validates the responsive shell. Backend pytest remains responsible for service, persistence, OpenAPI, and real PostgreSQL/pgvector behavior.

## Core data model

- A `Company` is the tenant root; departments, users, invitations, business data, documents, chunks, and conversations are scoped from it.
- `User` belongs to one company and optionally one department; roles are admin, manager, or employee.
- Customers, projects, tasks, notes, tags, and activity form the business domain. Customer/project/task tags use association tables.
- Folders are nested. Documents own immutable versions and may have tags, favorites, recents, chunks, and embeddings. Visibility is private, department, or company.
- Conversations belong to a company and owner; messages are ordered user/system/assistant records with JSON metadata.
- Refresh, password-reset, and invitation secrets are stored as hashes; activity and task comments are append-only through the exposed service/API surface.

## Document ingestion and RAG flow

1. The upload route validates declared MIME type and size, stores bytes in a company/document/version MinIO key, extracts text, and commits document/version metadata with `uploaded` status.
2. An in-process FastAPI background task opens an independent session and atomically claims `uploaded` or `failed` work as `processing`.
3. Text is split at paragraph boundaries with configured character overlap. OpenAI returns batches of vectors, which are normalized and persisted alongside chunks.
4. The lifecycle ends as `ready` or `failed`; a bounded error string is stored on failure.
5. Chat embeds the question, performs cosine similarity against pgvector using tenant/visibility predicates, applies a threshold and context limit, constructs a grounded prompt, and calls Meta chat.
6. The synchronous route returns and persists the answer with real retrieved-document citation metadata. Streaming routes emit tokens and persist only after successful completion; regeneration replaces the selected assistant row in place, while failure or cancellation leaves its prior content intact.

Important current detail: the migration initially creates the embedding column as text and the repository alters/casts it to `vector` during batch persistence/search. This works with the current PostgreSQL path but should remain covered by integration tests.

## Authorization boundaries

Tenant IDs come from authenticated server-side state. Admins have company-wide document visibility. Non-admins see company-visible documents, their own private documents, and documents for their department. Business services add further role/assignment/department rules. Conversation access requires both tenant and ownership matches.

## Runtime topology

The base Compose topology defines pgvector PostgreSQL 17, authenticated AOF-backed Redis, MinIO, an idempotent MinIO bucket initializer, an explicit Alembic migration job, the backend image, the standalone frontend image, and an opt-in pgAdmin profile. Environment overlays separate local, development, staging, and production bindings/policies. Named volumes retain database, Redis, object, and optional pgAdmin data. An internal data network isolates dependencies; an edge network connects the frontend/backend and operator-managed ingress.

Both application images use pinned language runtimes, multi-stage builds, non-root numeric users, read-only filesystems, dropped capabilities, `no-new-privileges`, bounded temporary filesystems, graceful stop periods, and health checks. Backend startup only starts Uvicorn; schema changes run through the separate `migrate` service/release gate.

Production observability is vendor-neutral: an ASGI middleware propagates request/correlation IDs, emits structured stdout logs and Prometheus request metrics, and creates OpenTelemetry request spans when OTLP export is enabled. Dependency health and AI attempt/retry/failover latency have bounded metric labels. The deployment supplies its own collector, log backend, alerting, TLS ingress, secret manager, backup scheduler, and off-site storage.

## Failure behavior

Database sessions roll back and close in the dependency. Liveness never probes dependencies; readiness returns 503 if PostgreSQL, Redis, or the configured private MinIO bucket is unavailable. Known domain errors are mapped to client-safe HTTP responses. Ingestion records failure state. Streaming emits a generic SSE error and does not persist a partial assistant message; the user message remains. Failed or cancelled regeneration retains the previous assistant response and citation metadata. Transient AI calls retry within configured bounds; a configured Meta fallback model is used only before any completion/stream output begins. If dashboard AI configuration, transport, provider output, or completion fails, the overview remains successful and returns an explicitly labelled deterministic summary derived from the same authorized live snapshot.
