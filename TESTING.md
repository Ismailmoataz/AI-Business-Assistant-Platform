# Testing

## Current test strategy

The backend has pytest suites for security primitives, identity lifecycle, tenant/department policy, business services and routes (including Phase 5D relationships, filters, tag usage, and activity), executive dashboard aggregation/AI fallback/tenant and role isolation, document visibility and ingestion, prompt construction, conversation titles/search, chat streaming/regeneration, citation serialization, OpenAPI completeness, and full PostgreSQL/pgvector RAG behavior. Most tests use an in-memory SQLite database with FastAPI dependency overrides; vector integration tests use a real PostgreSQL database.

The frontend has lint, TypeScript, production-build, and Playwright browser checks. The E2E layer drives the real Next.js UI against an isolated deterministic API simulator; it complements the backend pytest suites and does not replace their service, database, provider, or API-contract coverage. Automated component tests and coverage thresholds are not configured.

## Backend setup and commands

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
ruff check app tests
mypy app/config/settings.py app/database/connection.py app/services/infrastructure.py app/ai/providers.py app/observability.py app/api/routes/health.py app/main.py
bandit -q -r app
pip-audit -r requirements.txt
pytest -m "not integration"
```

Useful focused commands:

```powershell
pytest tests/test_auth_service.py tests/test_security.py
pytest tests/test_business_service.py tests/test_business_api.py
pytest tests/test_document_background_processing.py tests/test_document_service.py
pytest tests/test_conversations_api.py tests/test_chat_streaming.py tests/test_chat_citations.py tests/test_openapi_contract.py
pytest tests/test_dashboard_api.py tests/test_openapi_contract.py
```

`pytest.ini` configures function-scoped asyncio loops. Tests construct a valid test `Settings` environment before importing the app.

## PostgreSQL RAG integration

`tests/test_rag_integration.py` is marked `integration`. Set `TEST_POSTGRES_URL` to an isolated PostgreSQL database with all Alembic migrations applied and pgvector available:

```powershell
$env:TEST_POSTGRES_URL = "postgresql://user:password@localhost:5432/ai_business_test"
alembic upgrade head
pytest -m integration tests/test_rag_integration.py
```

Without `TEST_POSTGRES_URL`, these integration cases skip.

The suite creates isolated companies and cleans their tenant data. Never target a production/shared database. It verifies the complete upload → extraction → chunk → embedding → vector retrieval → grounded chat → persisted conversation flow and cross-tenant isolation.

## Frontend checks

```powershell
cd frontend
npm ci
npm run lint
npm run typecheck
npm run build
```

The production build is an important integration check for App Router server/client boundaries. `npm ci` should be used in CI because `package-lock.json` captures resolved versions even though `package.json` currently uses `latest` ranges.

## Browser E2E setup and commands

Playwright is configured in `frontend/playwright.config.ts`. Install its browser binaries once after `npm ci`:

```powershell
cd frontend
npx playwright install chromium firefox webkit
npm run e2e
```

The default command starts Next.js on `127.0.0.1:3100` and the synthetic API on `127.0.0.1:3101`. Both ports and server commands can be overridden with `E2E_APP_PORT`, `E2E_API_PORT`, `E2E_BASE_URL`, `E2E_MOCK_API_URL`, `E2E_WEB_SERVER_COMMAND`, and `E2E_MOCK_SERVER_COMMAND`. To exercise a production build locally:

```powershell
$env:NEXT_PUBLIC_API_URL = "http://127.0.0.1:3101"
npm run build
$env:E2E_WEB_SERVER_COMMAND = "npm run start -- --hostname 127.0.0.1 --port 3100"
npm run e2e
```

Useful development commands:

```powershell
npm run e2e -- --project=chromium
npm run e2e:headed
npm run e2e:debug
npm run e2e:report
npx playwright show-trace test-results/<failed-test>/trace.zip
```

Every test receives a unique seeded workspace, synthetic admin/manager/employee credentials, tenant A and tenant B records, and automatic cleanup. Fixtures authenticate through the same browser session store used by the application, while login/logout tests exercise the public auth API. API-response waits are scoped to the mock API origin; arbitrary sleeps are not used. Selectors prefer roles, labels, headings, and accessible names. The suite is fully parallel and retains traces, screenshots, and video only for failures.

The Chromium project covers authentication, protected routes, dashboard widgets/navigation/quick actions, AI conversation creation/continuation/SSE/regeneration/suggestions/citations/history, document upload/processing/search/preview/download/favorites, all core business-resource CRUD and filters, task Kanban/assignment/comments/status, global search, themes, keyboard navigation, responsive overflow, automated axe checks, tenant isolation, and permission restrictions. Firefox and WebKit run tagged cross-browser authentication/dashboard smoke tests, and mobile Chromium runs the responsive shell/document journey.

## CI usage

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`. It gates Ruff, targeted infrastructure typing, Bandit, dependency audits, backend tests, real PostgreSQL migration upgrade/downgrade, the pgvector integration suite, frontend lint/typecheck/build, all Playwright projects, and both container builds. Reports are uploaded as artifacts. CI retries failed browser cases twice; local runs do not retry so instability remains visible.

The release workflow reuses the full CI gate before publishing multi-architecture GHCR images with provenance/SBOM attestations and Trivy results. Deployment is a separate environment-protected manual workflow.

## Debugging failures

Start with the HTML report and the failing test's `error-context.md`. Open `trace.zip` to inspect DOM snapshots, network calls, console output, and action timing. Use `npm run e2e:debug -- -g "test name"` for the inspector or `npm run e2e:headed -- --project=chromium` to watch a focused case. Do not add fixed delays to mask a failure; wait for a specific response, lifecycle state, visible semantic element, or URL transition. A failure in the deterministic API simulator should be compared with the typed frontend client and backend contract before changing either side.

## Expectations for changes

- Identity/security changes: success, expired/reused/revoked token, inactive account, and wrong token-type cases.
- Tenant-aware changes: at least two tenants plus each relevant role, department, ownership, and soft-delete path.
- API changes: status/body validation, domain error mapping, OpenAPI metadata/examples, and frontend contract updates.
- Document/AI changes: empty/malformed input, provider failure, lifecycle rollback, visibility-before-ranking, and streaming cancellation/partial persistence.
- Migration changes: apply from the prior head on PostgreSQL and confirm downgrade behavior when supported.
- Frontend behavior: add or extend Playwright coverage for the affected journey, including keyboard flow, responsive layouts, light/dark themes, error/loading/empty states, refresh expiry, and role restrictions.

## Coverage gaps

There is no configured coverage threshold, component test suite, load test, MinIO/Redis failure-injection suite, visual-regression baseline, or live provider contract test. Browser E2E uses a deterministic API simulator and therefore does not prove that a deployed frontend, FastAPI, PostgreSQL, Redis, MinIO, and live AI providers interoperate; backend pytest, migration smoke checks, Compose verification, and the PostgreSQL RAG suite remain authoritative for those layers. These gaps are planned hardening, not evidence that the related runtime behavior is absent.
