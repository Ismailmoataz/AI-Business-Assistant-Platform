# Contributing

## Before starting

Read README, [PROJECT_STANDARDS.md](PROJECT_STANDARDS.md), [ARCHITECTURE.md](ARCHITECTURE.md), and the subsystem-specific guide. The worktree may contain active uncommitted work; inspect `git status` and do not discard, reformat, or overwrite unrelated changes.

## Development setup

```powershell
Copy-Item infrastructure/environments/local.env.example .env
docker compose --env-file .env -f docker-compose.yml -f docker-compose.local.yml up -d postgres redis minio

cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
alembic upgrade head

cd ../frontend
npm ci
```

Fill `.env` with local, non-production values and provider credentials only when needed. Use the matching environment overlay and run the one-shot `minio-init` and `migrate` services before starting application containers. The backend settings load `.env` relative to the process working directory; run direct backend/Alembic commands from `backend` when using `backend/.env`.

## Change workflow

1. Confirm current behavior in code and tests; older `docs/` phase documents may be stale.
2. Keep changes within existing layers: route → service → repository → model/migration, and component → API client → backend contract.
3. Add an Alembic revision for every schema change; never add startup `create_all()` behavior.
4. Add tests for the behavior and authorization boundary, including cross-tenant negatives.
5. Run relevant checks and inspect the final diff for secrets/generated files.
6. Update root documentation and `CHANGELOG.md` when capabilities, configuration, API, security, or deployment behavior changes.

## Style and scope

- Follow existing typed Python/TypeScript patterns and favor small, focused modules.
- Keep route handlers thin and tenant/authorization policy server-side.
- Reuse frontend tokens/primitives and provide accessible loading, empty, error, and keyboard states.
- Avoid unrelated dependency upgrades or mechanical rewrites in feature changes.
- Do not commit `.env`, virtual environments, caches, `.next`, database files, provider responses, or uploaded documents.

## Verification

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

Run `pytest -m integration tests/test_rag_integration.py` with an isolated migrated PostgreSQL database for retrieval, embedding, migration, or tenant-vector changes.

## Review checklist

- The public behavior is accurately described and does not invent unfinished functionality.
- Tenant/role/department/owner filters occur before pagination, download, or ranking.
- Input and failure paths have stable schemas/statuses and no sensitive details.
- Migrations, ORM models, schemas, frontend types, OpenAPI, and docs agree.
- Secrets and personal/company document data are absent from commits/logs/fixtures.
- Tests cover both expected behavior and unauthorized/cross-tenant behavior.

No pull-request template, branch naming rule, commit convention, required-check policy, or code-owner file is currently defined. Unified CI runs on pull requests, but branch protection must still be configured in GitHub. Use clear imperative commit messages and describe motivation, behavior, migrations/config changes, verification performed, and remaining limitations in the review description.
