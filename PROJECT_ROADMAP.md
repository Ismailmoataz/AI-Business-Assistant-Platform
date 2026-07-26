# Project Roadmap

This roadmap is a status view of the current repository. “Planned” means an implementation gap evidenced by the codebase; it is not a delivery commitment.

## Completed

- **Identity foundation:** company-admin registration, login, JWT access/refresh tokens, refresh rotation and revocation, logout, password reset primitives, employee invitations, and `/users/me`.
- **Tenant administration:** companies, departments, employee directory, department assignment, and admin/manager/employee authorization.
- **Business operations API:** customers, projects, tasks, immutable comments, notes, tags, soft deletes, filters, pagination, and activity history.
- **Knowledge storage API:** nested folders, document visibility, MinIO uploads/downloads, version records, metadata/text search, favorites, recents, archive status, soft delete, restore, and signed URLs.
- **Retrieval foundation:** document extraction for PDF, DOCX, XLSX, and plain text; background lifecycle; chunking; OpenAI embeddings; pgvector migration/query; tenant/owner/department visibility filters.
- **AI conversations:** Meta Llama chat provider, bounded retrieval context, provider-neutral prompt construction, persistent conversations/messages, automatic first-message titles, title/message search with pagination, synchronous chat, SSE streaming, in-place assistant regeneration, and structured source citations.
- **Frontend foundation:** Orbit-branded responsive shell, authentication/password-reset forms, theme support, persisted auth/UI state, automatic token refresh, a production executive dashboard, reusable UI components, a responsive AI Workspace, and a responsive Documents Workspace with nested folders, search, filtering, sorting, favorites, recents, uploads, processing state, and previews.
- **Executive dashboard:** live company/date/time context; tenant-authorized KPI, notes, and storage aggregates; AI-generated daily briefs with live-data fallback; role-aware quick actions; paginated activity; current-user work; document lifecycle, project health, AI conversation, customer, and employee widgets; global search access; and persisted widget order, collapse, and layout preferences.
- **Projects and Tasks workspace:** responsive project grid/table and detail routes; task list/Kanban/table and detail routes; debounced backend search; status, priority, assignee, project, and tag filters; sorting; role-aware create/edit/delete; persisted task moves; comments, notes, and entity-scoped activity.
- **Business workspace:** responsive employee and customer directories and profiles; customer lifecycle management; linked projects, tasks, notes, and documents; Markdown note CRUD; tag management and usage views; exact-entity activity; and debounced global search across business records.
- **Quality foundation:** pytest coverage for identity, security, tenant rules, business flows, document processing, OpenAPI, chat streaming, conversation titles, production infrastructure, and optional end-to-end PostgreSQL RAG behavior; isolated parallel Playwright coverage for critical desktop/mobile journeys, cross-browser smoke checks, accessibility, tenant isolation, and permissions; and unified backend, migration, frontend, browser, and container CI.
- **Production infrastructure foundation:** optimized non-root backend/frontend containers; environment-specific Compose overlays; explicit migrations; PostgreSQL, authenticated Redis, and versioned private MinIO startup gates; liveness/readiness/metrics endpoints; structured request-correlated logging; Prometheus and optional OpenTelemetry instrumentation; provider retry/failover; immutable GHCR releases; image scanning; and a guarded deployment workflow.

## In progress / partially integrated

- **Frontend coverage:** authentication, dashboard, AI Workspace, Documents Workspace, and core business resources are product screens; company and department administration remain API-only.
- **Google OAuth:** authorization URL and Redis state generation exist; callback validation, code exchange, account linking/login, and frontend callback handling do not.
- **Conversation history in generation:** conversations persist, but current route orchestration does not pass stored history into the prompt builder.
- **Document replacement ingestion:** replacement creates a new version, but the route does not schedule the background ingestion task used by initial upload.
- **Deployment integration:** container and CI/CD foundations are present, but the target environment must still supply TLS/reverse proxying, managed secrets, observability/alerting backends, external backup storage/automation, and a hardened self-hosted deployment runner.

## Planned hardening

- Add frontend routes and role-aware navigation for remaining company and department administration APIs.
- Complete the OAuth callback flow or remove the unfinished UI entry point until it is usable.
- Add durable background processing instead of in-process FastAPI background tasks, with retry/observability policy.
- Re-ingest replacement versions and define cleanup behavior for stale chunks/object versions.
- Pass bounded, authorized conversation history to new-turn chat generation.
- Add API rate limiting, login abuse controls, content scanning, and stronger upload validation beyond declared MIME type.
- Connect the vendor-neutral telemetry outputs to selected production backends, define service-level alerts, automate encrypted PostgreSQL/MinIO backups, and exercise restore/disaster-recovery drills.
- Add frontend component and visual-regression tests, connect browser smoke tests to a deployed full stack, and broaden negative security/API coverage.
- Align frontend/backend password-length validation and activity TypeScript contracts with backend responses.
- Replace unconstrained npm `latest` ranges with an intentional update policy while retaining the lockfile.

## Deferred / not implemented

There are no autonomous agents, workflow engine, email delivery provider, external business-system integrations, billing, mobile client, websocket transport, or production Kubernetes/cloud manifests in the current repository. Earlier design notes under `docs/` may discuss broader phases; they do not override this status.
