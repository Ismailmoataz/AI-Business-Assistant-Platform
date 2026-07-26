# Changelog

## Production Infrastructure — Phase 8

- Added optimized multi-stage non-root backend and standalone frontend images, environment-specific Compose overlays, authenticated/health-gated PostgreSQL/Redis/MinIO services, private versioned bucket initialization, explicit migrations, resource-safe defaults, and restart/logging policies.
- Added strict staging/production environment validation, complete configuration examples, liveness/readiness/dependency health, Prometheus metrics, optional OpenTelemetry export, structured request-correlated logging, and hardened response/host/CORS handling.
- Added pooled dependency clients, Redis and MinIO retry/timeout behavior, AI provider timeout/backoff/fallback instrumentation, safe object-stream cleanup, and production query indexes.
- Replaced the browser-only workflow with unified backend/frontend/migration/Playwright/container CI, corrected the PostgreSQL integration marker so the RAG suite actually runs, added zero-vulnerability dependency gates, pinned the patched Next.js release with narrow PostCSS/Sharp security overrides, published multi-architecture GHCR images with provenance/SBOM and Trivy scanning, and added an environment-protected deployment workflow.
- Added deployment, migration, backup/restore, upgrade, rollback, and disaster-recovery runbooks plus production-infrastructure regression tests.

## End-to-End Testing — Phase 7

- Added Playwright with isolated per-test workspaces, generated auth sessions, seeded multi-role/multi-tenant data, automatic cleanup, semantic selectors, explicit API/lifecycle synchronization, and failure traces/screenshots/video.
- Added critical browser journeys for authentication, dashboard, AI streaming/regeneration/suggestions/citations/history, document upload/processing/search/preview/download/favorites, projects, tasks/Kanban/assignment/comments, customers, employees, notes, tags, global search, themes, responsive layouts, keyboard navigation, accessibility, tenant isolation, and permission restrictions.
- Added Chromium full coverage, tagged Firefox/WebKit smoke checks, mobile Chromium coverage, a production-build GitHub Actions workflow, and local/CI/debugging documentation.
- Associated authentication labels with their controls and adjusted light-theme muted/success tokens to satisfy automated WCAG contrast checks.

## Executive Dashboard — Phase 5E

- Replaced dashboard sample values with a tenant- and role-authorized executive overview API covering the real company, exact project, task, employee, customer, document, note, storage, and AI-conversation metrics.
- Added a daily provider-generated business brief over bounded authorized facts with a clearly labelled deterministic live-data fallback when AI is unavailable.
- Added modular responsive My Work, Project Health, Document Lifecycle, AI Conversation, Customer, Employee, and lazy-loaded paginated Activity widgets with direct workspace navigation.
- Integrated a live local date/time, role-aware quick actions, the existing command search and `Ctrl/Command+K` shortcut, explicit loading/error/empty/restricted states, keyboard-labelled controls, and persisted balanced/compact layout, widget order, and collapsed sections.
- Added dashboard API coverage for live aggregates, provider prompting, fallback behavior, cross-tenant isolation, employee customer restrictions, and OpenAPI completeness. No database migration was required.

## Business Workspace — Phase 5D Part 2

- Added protected Employee and Customer directories with responsive grid/table views, debounced backend search, filters, sorting, pagination, profile editing, linked work, notes, documents, and exact-entity activity.
- Added Customer create/edit/archive/delete flows and tenant-safe links from customers to projects, documents, and Markdown notes.
- Added dedicated Notes and Tags workspaces with CRUD, relationship-aware notes, reusable colors, usage counts, linked-record views, and activity history.
- Added accessible command search across employees, customers, projects, tasks, and notes with partial-result handling for role-restricted resources.
- Added an additive Alembic migration and API regression coverage for business relationships, directory filters, note search, tag usage, and activity contracts.

## Projects and Tasks Workspace — Phase 5D Part 1

- Added protected project grid/table and project-detail routes with debounced backend search, status/owner/tag filters, sorting, progress, team, linked tasks, notes, and entity-scoped activity.
- Added protected task list/Kanban/table and task-detail routes with search, status/priority/assignee/project/tag filters, sorting, comments, notes, activity, role-aware CRUD/reassignment, and accessible persisted status changes.
- Added the `review` task workflow state, task priority/tag/search/sort query support, project owner/tag/sort query support, ordered comments in task details, and exact entity activity filtering.
- Added an Alembic migration and API regression coverage for the expanded business workspace contract.

## Documents Workspace — Phase 5C Part 1

- Added the protected `/documents` workspace with nested folders, breadcrumbs, grid/list browsing, debounced search, filters, sorting, optimistic favorites, recents, upload progress/cancellation, processing polling, metadata/version details, supported-type previews, and authorized downloads.
- Corrected favorites and recents route declaration order so their static collection endpoints are matched before the dynamic document UUID route.

This changelog summarizes capabilities evidenced by the current repository and migration history. The repository does not contain release tags or dated release notes, so entries are grouped by implemented phase rather than claiming published versions.

## Unreleased — current worktree

### Added

- Next.js Orbit frontend with authentication/password-reset pages, dashboard, responsive application shell, theme support, reusable UI primitives, persisted client state, TanStack Query, and automatic refresh-token retry.
- Production AI Workspace with responsive conversation history, debounced server-side search and optimistic management, rich Markdown/code rendering, an accessible auto-growing composer, cancelable SSE token rendering, in-place regeneration, expandable document citations, scroll preservation, and complete loading/empty/error states.
- Provider-neutral AI interfaces with Meta Llama chat and OpenAI embedding implementations.
- Document text extraction, chunking, batch-normalized embeddings, tenant-visible pgvector retrieval, bounded prompt context, and grounded chat orchestration.
- Persistent company/owner-scoped conversations and messages, paginated title/message search, synchronous chat, SSE streaming, in-place assistant regeneration, and citation metadata.
- Tenant-safe conversation rename/delete endpoints and last-message previews for paginated history.
- Document processing lifecycle states (`uploaded`, `processing`, `ready`, `failed`) with independent-session background ingestion and failure recording.
- OpenAPI metadata/example enrichment and contract tests.
- Backend tests covering background processing, RAG integration, prompts, streaming/regeneration, conversation titles/search, citation serialization, tenant isolation, and API/schema behavior.

### Changed

- Root application description and router assembly now include documents, retrieval, conversations, and chat beyond the earlier business-only phase.
- PostgreSQL container uses the pgvector PostgreSQL 17 image.
- Backend dependencies include HTTP/provider, document parsing, multipart, and spreadsheet support.
- The authenticated application shell treats the AI Workspace as a full-height primary experience, and dashboard prompts now open it with their content prefilled.

### Known incomplete integrations

- Company/department administration APIs do not yet have dedicated frontend screens, and the frontend is not deployed by Compose.
- Google OAuth stops after authorization URL/state creation.
- Stored conversation history is not included in new-turn generation prompts.
- Document replacement does not schedule re-ingestion.

## Phase 3 — knowledge documents

### Added

- Nested tenant folders and private/department/company visibility.
- MinIO-backed uploads, immutable version metadata, downloads and short-lived signed URLs.
- Document metadata/extracted-text search, tags, favorites, recents, archive state, soft delete, and restore.
- Document chunk/embedding tables and pgvector extension migration.

## Phase 2 — business operations

### Added

- Tenant-scoped employees, customers, projects, tasks, immutable comments, notes, tags, and activity history.
- Role- and department-aware access, soft deletion, filtering, searching, pagination, validation, and tenant foreign-reference checks.
- PostgreSQL migrations and Redis/MinIO/PostgreSQL readiness checks.

## Phase 1 — identity and tenancy

### Added

- Companies, departments, users, and invitations.
- Argon2 passwords; JWT access/refresh tokens; persisted refresh rotation/revocation; logout; one-time password resets.
- Admin/manager/employee roles and tenant-safe company/department administration.
- Alembic migration foundation and FastAPI application/OpenAPI surface.

Historical narrative files under `docs/` may describe intended phases. This changelog records only behavior visible in the current code and migrations.
