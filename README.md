# AI Business Assistant Platform

AI Business Assistant Platform is a multi-tenant business operations and knowledge-retrieval application. The current repository contains a FastAPI backend, a Next.js frontend branded **Orbit**, PostgreSQL/pgvector persistence, Redis-backed OAuth state, MinIO document storage, and provider-backed retrieval-augmented chat.

## Current capabilities

- Company registration, Argon2 password authentication, JWT access and refresh tokens, token rotation/revocation, password reset, and employee invitations.
- Tenant-, role-, and department-aware employees, customers, projects, tasks, comments, notes, tags, and immutable activity records.
- Private, department, and company document visibility; nested folders; uploads, versions, search, favorites, recents, soft deletion, backend downloads, and signed URLs.
- Background text extraction, chunking, OpenAI embeddings, PostgreSQL/pgvector similarity search, Meta Llama chat completion, persistent searchable conversations, in-place response regeneration, structured citations, and SSE token streaming.
- Responsive authentication, executive dashboard, AI, Documents, Projects, Tasks, Employees, Customers, Notes, and Tags workspaces with theme support, client-side validation, bearer-token refresh, server-backed search/filter/sort, global business search, persistent conversations, business CRUD, task Kanban, activity, Markdown responses, source opening, and live SSE token rendering.
- Tenant- and role-aware executive insights with real company context, a live local clock, exact KPIs including notes and storage usage, a daily provider-generated brief with deterministic fallback, current-user work, project health, document lifecycle, recent AI/customer/employee context, role-aware quick actions, paginated activity, and persisted widget preferences.

The frontend currently exposes authentication, dashboard, AI Workspace, Documents Workspace, and the core business workspaces. Company/department administration remains API-only. Google OAuth currently generates and stores authorization state but has no callback/token-exchange endpoint.

## Repository map

```text
backend/                  FastAPI application, Alembic migrations, and pytest suite
  app/api/                Route handlers and authentication dependencies
  app/ai/                 Chat and embedding provider abstractions
  app/database/models/    SQLAlchemy domain models
  app/repositories/       Persistence queries
  app/services/           Domain, document, retrieval, and chat orchestration
  tests/                  Unit, API, streaming, OpenAPI, and optional PostgreSQL tests
frontend/                 Next.js App Router application and component library
  e2e/                    Isolated Playwright fixtures, API simulator, and browser journeys
infrastructure/docker/    Backend and frontend container definitions
infrastructure/environments/
                          Local, development, staging, and production examples
docs/                     Earlier architecture/design records; verify against current code
docker-compose*.yml       Base topology plus environment-specific overlays
```

See [ARCHITECTURE.md](ARCHITECTURE.md), [API_GUIDELINES.md](API_GUIDELINES.md), and [UI_UX_GUIDELINES.md](UI_UX_GUIDELINES.md) for subsystem detail.

## Prerequisites

- Docker Engine with Compose for the backend stack.
- Node.js and npm for the frontend. The lockfile is authoritative for resolved versions.
- Python 3.12-compatible tooling for direct backend development.
- Meta Llama API credentials for chat and OpenAI credentials for embeddings when exercising AI paths.

## Configuration

Create an environment file from the matching template under `infrastructure/environments/`. `backend/.env.example` is the complete backend/Compose variable reference and `frontend/.env.example` documents the build-time browser API URL.

Required core values include `DATABASE_URL`, MinIO credentials, and `JWT_SECRET_KEY`. Relevant AI values are `CHAT_PROVIDER=meta`, `META_API_KEY`, `CHAT_MODEL`, `EMBEDDING_PROVIDER=openai`, `OPENAI_API_KEY`, and `EMBEDDING_MODEL`. Never commit `.env`.

The frontend reads `NEXT_PUBLIC_API_URL` at build time. Staging and production startup also validate credentials, explicit hosts/origins, secure cookies, structured logging, and provider URL/credential combinations.

## Run locally

```powershell
Copy-Item infrastructure/environments/local.env.example .env
docker compose --env-file .env -f docker-compose.yml -f docker-compose.local.yml build
docker compose --env-file .env -f docker-compose.yml -f docker-compose.local.yml up -d postgres redis minio
docker compose --env-file .env -f docker-compose.yml -f docker-compose.local.yml run --rm minio-init
docker compose --env-file .env -f docker-compose.yml -f docker-compose.local.yml run --rm migrate
docker compose --env-file .env -f docker-compose.yml -f docker-compose.local.yml up -d backend frontend
```

The local overlay binds PostgreSQL (`5432`), Redis (`6379`), MinIO (`9000`/`9001`), pgAdmin (`5050`), the API (`8000`), and frontend (`3000`) to `127.0.0.1`; pgAdmin is opt-in through the `admin` profile. In non-production environments, Swagger UI is available at `http://localhost:8000/docs`.

## Quality checks

```powershell
cd backend
ruff check app tests
mypy app/config/settings.py app/database/connection.py app/services/infrastructure.py app/ai/providers.py app/observability.py app/api/routes/health.py app/main.py
bandit -q -r app
pytest -m "not integration"

cd ../frontend
npm run lint
npm run typecheck
npm run build
npx playwright install chromium firefox webkit
npm run e2e
```

The PostgreSQL RAG integration tests require `TEST_POSTGRES_URL` and a database with the migrations and pgvector extension applied. See [TESTING.md](TESTING.md).

## Documentation

- [PROJECT_STANDARDS.md](PROJECT_STANDARDS.md) — repository conventions and boundaries
- [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) — implemented, in-progress, and planned work
- [ARCHITECTURE.md](ARCHITECTURE.md) — components, data flow, and persistence
- [API_GUIDELINES.md](API_GUIDELINES.md) — HTTP contract and endpoint inventory
- [UI_UX_GUIDELINES.md](UI_UX_GUIDELINES.md) — current frontend system and interaction rules
- [SECURITY.md](SECURITY.md) — implemented controls, limitations, and reporting
- [TESTING.md](TESTING.md) — suites, environments, and commands
- [DEPLOYMENT.md](DEPLOYMENT.md) — current container topology and release procedure
- [CONTRIBUTING.md](CONTRIBUTING.md) — development workflow
- [CHANGELOG.md](CHANGELOG.md) — repository history visible from the current implementation
- [DECISIONS.md](DECISIONS.md) — architecture decisions evidenced by code

## Status

This is an active development codebase, not a production-complete distribution. Current operational gaps are tracked in [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) and [SECURITY.md](SECURITY.md). The project is licensed under the MIT License.
