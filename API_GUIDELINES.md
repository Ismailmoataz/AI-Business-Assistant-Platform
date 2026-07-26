# API Guidelines

## Contract

The FastAPI application exposes an unversioned HTTP API at the server root. OpenAPI reports application version `1.0.0`. Swagger UI (`/docs`) and ReDoc (`/redoc`) are disabled when `ENVIRONMENT=production`; the schema is generated from routes and enriched with deterministic examples in `app/openapi.py`.

JSON is the default media type. Upload uses `multipart/form-data`, download returns the stored MIME type as a stream, and `/chat/stream` plus `/chat/regenerate/stream` return `text/event-stream`.

## Authentication

Protected endpoints require `Authorization: Bearer <access_token>`. Access and refresh JWTs include issuer, audience, subject/user, company, role, type, token ID, issued-at, and expiry claims. Refresh tokens are rotated through `POST /auth/refresh` and revoked on reuse/logout/password reset. The frontend sends tokens in request bodies/local browser state; cookie settings exist in backend configuration but the current routes do not set authentication cookies.

## Endpoint inventory

| Area | Current routes |
| --- | --- |
| Root/operations | `GET /`, `GET /health/live`, `GET /health/ready`, `GET /health` (readiness compatibility alias), `GET /metrics` |
| Authentication | `POST /auth/register`, `/login`, `/refresh`, `/logout`, `/password-reset/request`, `/password-reset/confirm`; `GET /auth/google/authorize-url` |
| Identity/admin | `GET /users/me`, `POST /invitations`, `POST /invitations/accept`, `GET /companies/me`, `GET/POST /departments`, `PATCH /companies/users/{user_id}/department` |
| Employees | `GET /employees`, `GET/PATCH /employees/{employee_id}` |
| Customers | `GET/POST /customers`, `GET/PATCH/DELETE /customers/{customer_id}` |
| Projects | `GET/POST /projects`, `GET/PATCH/DELETE /projects/{project_id}` |
| Tasks | `GET/POST /tasks`, `GET/PATCH/DELETE /tasks/{task_id}`, `POST /tasks/{task_id}/comments` |
| Notes | `GET/POST /notes`, `GET/PATCH/DELETE /notes/{note_id}` |
| Tags/activity | `GET/POST /tags`, `GET/PATCH/DELETE /tags/{tag_id}`, `GET /activity` |
| Dashboard | `GET /dashboard/overview` |
| Folders | `GET/POST /folders`, `PATCH /folders/{folder_id}` |
| Documents | `POST /documents/upload`; `GET /documents`; `GET/PATCH/DELETE /documents/{id}`; replace, versions, download, signed URL, favorite, restore; favorite/recent lists |
| Conversations | `GET/POST /conversations`, `GET/PATCH/DELETE /conversations/{id}`, `POST /conversations/{id}/messages` |
| Chat | `POST /chat/message`, `POST /chat/stream`, `POST /chat/regenerate/stream`, `GET /chat/conversations` |

Use generated OpenAPI for exact fields, enum values, required properties, and endpoint-specific authorization.

`/health/live` is process-only and never probes dependencies. `/health/ready` and `/health` check PostgreSQL, authenticated Redis, and the configured MinIO bucket and return 503 if any dependency is unavailable. `/metrics` is intentionally excluded from OpenAPI, can be disabled, and supports a dedicated bearer token for deployments that cannot restrict it at the network layer. Every HTTP response includes `X-Request-ID` and `X-Correlation-ID`; valid inbound values are propagated.

## Requests and responses

- UUIDs are used for identifiers; timestamps are timezone-aware ISO 8601 values.
- List endpoints generally accept `offset` (default 0) and `limit` (default 25, maximum 100), plus resource filters.
- Paginated responses use `{"items": [...], "page": {"offset": 0, "limit": 25, "total": 0}}`.
- Project lists support backend `search`, `status`, `owner_id`, `tag_id`, and `sort` (`name`, `due_date`, or `updated`) parameters. Task lists support `search`, `project_id`, `assignee_id`, `status`, `priority`, `tag_id`, and `sort` (`name`, `due_date`, `priority`, or `updated`).
- Employee lists support `search`, `department_id`, `role`, `status`, and `sort`; customer lists support `search`, `status`, `customer_type`, `tag_id`, and `sort`. Project lists additionally accept `customer_id`.
- Note lists support body/title `search`, scope, owner, project, employee, customer, task, document, tag, and title/updated sorting. Notes may link to one employee, customer, task, or document; task-linked project notes derive their project relationship server-side.
- Document lists may be narrowed by `owner_id` or `customer_id`. Tag responses expose active customer/project/task/note usage counts.
- Task status values are `todo`, `in_progress`, `review`, `blocked`, and `done`. Task detail responses include ordered comments; project/task collection responses remain summary records without comments.
- Activity lists may be narrowed by `entity_type` and exact `entity_id`, in addition to their existing action/actor/date filters.
- Conversation list endpoints accept an optional `search` value that matches owned conversation titles or any persisted message content before pagination. List/detail responses include a nullable `last_message_preview`; previews are trimmed from the newest persisted message and bounded to 180 characters.
- Create operations normally return 201. Deletes, logout, and favorite mutations without response data return 204.
- `PATCH` bodies are partial and exclude unset fields.
- Chat responses include conversation ID, answer text, unique source document names, structured citations, and optional input/output token counts. A citation contains only retrieved data: document ID, title, filename, chunk index, and similarity score. Signed URLs are never stored as citation metadata.
- The dashboard overview returns the current user and company, exact visible KPI/storage aggregates including role-scoped notes, an AI-generated or explicitly labelled fallback brief, current-user work, bounded document/project/customer/employee summaries, and the caller's recent conversations. Employee-role customer fields remain unavailable rather than broadening customer access. The existing `/activity` endpoint remains the paginated timeline contract.

SSE frames from both streaming chat routes are:

```text
data: {"token":"..."}

event: complete
data: {"message_id":"...","citations":[...]}
```

`POST /chat/regenerate/stream` accepts a conversation ID and assistant message ID. The server resolves the preserved preceding user prompt and replaces that assistant message only after successful completion. On provider failure the stream emits `event: error` with a generic detail. The HTTP response itself has already started and remains 200.

## Error semantics

| Status | Meaning |
| --- | --- |
| 400 | Invalid workflow/domain state or invalid one-time token |
| 401 | Missing, invalid, expired, wrong-type token, inactive user/company, or bad credentials |
| 403 | Authenticated but role/scope/visibility policy rejects access |
| 404 | Authorized resource lookup found no visible record |
| 409 | Uniqueness/conflict such as duplicate tenant data |
| 422 | Pydantic/FastAPI request validation failure |
| 503 | Readiness dependency unavailable |

Avoid leaking whether a cross-tenant object exists. Password-reset request always returns the same accepted message; raw reset tokens are currently returned only by the service layer and are not delivered by an email integration.

## Adding or changing endpoints

1. Add or update a schema before exposing persistence models.
2. Enforce tenant and role policy in dependencies/services and tenant-filter repositories.
3. Map domain errors consistently and declare the response model/status.
4. Add a tag/docstring and ensure OpenAPI examples and references pass contract tests.
5. Add API/service tests for success, invalid input, role denial, and cross-tenant denial.
6. Update this file, security guidance, frontend types/client, and changelog when the public contract changes.

There is no URL-versioning or compatibility/deprecation framework yet. Treat current paths as an evolving internal contract and coordinate breaking changes across backend and frontend.
