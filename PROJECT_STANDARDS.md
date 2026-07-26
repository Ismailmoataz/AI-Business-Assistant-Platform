# Project Standards

These standards describe the conventions already present in the repository and the rules contributors should preserve.

## Source of truth

Runtime code, Alembic migrations, dependency manifests, and executable tests take precedence over narrative documentation. Update affected documentation in the same change as a contract, dependency, security policy, environment variable, or deployment change.

## Backend structure

- Route handlers in `backend/app/api/routes` translate HTTP input/output and domain exceptions; they should not own persistence policy.
- Services in `backend/app/services` enforce tenant, role, visibility, and workflow rules.
- Repositories in `backend/app/repositories` contain reusable SQLAlchemy queries and tenant filters.
- SQLAlchemy models in `backend/app/database/models` define persisted entities; Pydantic models in `backend/app/schemas` define public contracts.
- Provider-specific AI code stays behind the abstract interfaces in `backend/app/ai/providers.py`.
- Database changes are explicit, ordered Alembic revisions. Application startup must not call `Base.metadata.create_all()`.

Python code uses type annotations, short module/class docstrings, dependency injection for sessions and provider seams, and domain-specific exceptions. Keep imports rooted at `app` when running with `backend` on `PYTHONPATH`.

## Tenant and authorization invariants

- Derive tenant identity from the authenticated user/JWT; never accept a caller-selected `company_id` for authorization.
- Include `company_id` in tenant-scoped reads and writes, including background jobs and vector retrieval.
- Apply visibility filtering before pagination and ranking.
- Verify referenced departments, owners, assignees, folders, tags, and projects belong to the same company.
- Keep role policy in services/dependencies. Current roles are `admin`, `manager`, and `employee`.
- Preserve soft deletion for mutable business/documents records and immutability for activity and task-comment history.

## API conventions

- Use plural resource paths and UUID path identifiers.
- Use Pydantic request/response models and explicit response status codes.
- Collection pagination uses `offset`, `limit`, and `{items, page: {offset, limit, total}}`; limits are generally 1–100.
- Use `PATCH` for partial updates and `204 No Content` for successful operations without a body.
- Convert known domain failures to stable 400/401/403/404/409 responses without exposing infrastructure details.
- Add route tags, summaries/docstrings, response models, and examples that satisfy the OpenAPI contract tests.

## Database standards

- Use UUID primary keys, timezone-aware timestamps, explicit foreign-key deletion behavior, indexes on tenant/filter columns, and named constraints.
- Persist enum values, not Python enum member names.
- Make tenant uniqueness explicit (for example, company/name pairs).
- Keep migrations reversible where the current data model permits it and test both model and migration assumptions against PostgreSQL when pgvector is involved.

## AI and document standards

- Keep chat and embedding providers independently configurable.
- Normalize generated embeddings before persistence and enforce document visibility in the SQL similarity query.
- Treat retrieved text as untrusted context. Prompts must instruct the model to use supplied context and acknowledge insufficient evidence.
- Persist source metadata and token usage when provided; do not claim citations that the response contract does not contain.
- Use object keys namespaced by company/document identifiers and keep buckets non-public; authorize before download or signed-URL generation.
- Background ingestion must use its own session and maintain the `uploaded → processing → ready|failed` lifecycle.

## Frontend standards

- Use the Next.js App Router, strict TypeScript, `@/` imports, and client components only when browser state or hooks require them.
- Route backend calls through `frontend/lib/api/client.ts`; preserve the single-flight refresh behavior.
- Validate forms with Zod and React Hook Form, expose field errors with accessible text, and show asynchronous outcomes through Sonner.
- Reuse design tokens and primitives from `globals.css` and `components/ui`; preserve light/dark and reduced-motion behavior.
- Do not present placeholder metrics as live data without the current explicit degraded/loading treatment.

## Dependencies and secrets

- Python dependencies are pinned exactly in `requirements*.txt`.
- The npm lockfile is the reproducible dependency source; avoid unnecessary `latest` manifest churn and commit lockfile changes with package changes.
- Secrets belong in environment variables. Examples contain placeholders only; logs, errors, fixtures, and documentation must not contain credentials or raw tokens.

## Required checks

Backend changes should run the relevant pytest subset and OpenAPI contract tests. PostgreSQL/pgvector changes should also run the marked integration tests. Frontend changes should run lint, typecheck, production build, and the relevant Playwright project/specs; changes to shared journeys, auth, authorization, routing, or responsive layout should run the full browser matrix. Documentation-only changes require link, command, terminology, and cross-document review.
