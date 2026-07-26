"""Stable OpenAPI metadata and examples for the public HTTP API."""

from copy import deepcopy
from typing import Any

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi


OPENAPI_TAGS = [
    {"name": "Root", "description": "API discovery and service metadata."},
    {"name": "Health", "description": "Operational dependency readiness."},
    {"name": "Authentication", "description": "Registration, sessions, and account recovery."},
    {"name": "Users", "description": "Authenticated user profile operations."},
    {"name": "Invitations", "description": "Tenant employee invitation lifecycle."},
    {"name": "Companies", "description": "Current-company information and membership administration."},
    {"name": "Departments", "description": "Company department management."},
    {"name": "Employees", "description": "Tenant-scoped employee directory."},
    {"name": "Customers", "description": "Tenant customer records."},
    {"name": "Projects", "description": "Department-aware project management."},
    {"name": "Tasks", "description": "Project task and comment workflows."},
    {"name": "Notes", "description": "Personal and shared business notes."},
    {"name": "Tags", "description": "Reusable tenant classification tags."},
    {"name": "Activity", "description": "Immutable tenant activity history."},
    {"name": "Dashboard", "description": "Tenant-authorized executive overview and AI brief."},
    {"name": "Folders", "description": "Knowledge folder hierarchy and visibility."},
    {"name": "Documents", "description": "Knowledge documents, versions, and access."},
    {"name": "Conversations", "description": "Persistent tenant-isolated AI conversations."},
    {"name": "Chat", "description": "Synchronous and streaming AI chat."},
]


def _string_example(name: str, schema: dict[str, Any]) -> str:
    """Return a safe representative string that respects common formats and constraints."""
    lowered = name.lower()
    if schema.get("format") == "uuid" or lowered.endswith("_id") or lowered == "id":
        return "123e4567-e89b-12d3-a456-426614174000"
    if schema.get("format") == "date-time":
        return "2026-07-20T12:00:00Z"
    if schema.get("format") == "date":
        return "2026-07-20"
    if schema.get("format") == "email" or "email" in lowered:
        return "user@example.com"
    if "password" in lowered:
        return "Example-Password-7!"
    if "token" in lowered:
        return "example-token-00000000000000000000000000000000"
    if "url" in lowered:
        return "https://example.com/resource"
    if lowered in {"company_slug", "slug"}:
        return "example-company"
    values = schema.get("enum")
    if values:
        return str(values[0])
    minimum = max(int(schema.get("minLength", 0)), 1)
    value = schema.get("title") or name.replace("_", " ").title() or "Example"
    return str(value) if len(str(value)) >= minimum else str(value) + ("x" * (minimum - len(str(value))))


def _example(schema: dict[str, Any], components: dict[str, Any], name: str = "value", seen: set[str] | None = None) -> Any:
    """Build one deterministic JSON-compatible example from an OpenAPI schema."""
    seen = set() if seen is None else seen
    if "example" in schema:
        return deepcopy(schema["example"])
    if "default" in schema:
        return deepcopy(schema["default"])
    reference = schema.get("$ref")
    if reference:
        schema_name = reference.rsplit("/", 1)[-1]
        if schema_name in seen:
            return {}
        return _example(components.get(schema_name, {}), components, schema_name, seen | {schema_name})
    alternatives = schema.get("oneOf") or schema.get("anyOf")
    if alternatives:
        selected = next((item for item in alternatives if item.get("type") != "null"), alternatives[0])
        return _example(selected, components, name, seen)
    if schema.get("enum"):
        return deepcopy(schema["enum"][0])
    schema_type = schema.get("type")
    if schema_type == "object" or "properties" in schema:
        return {key: _example(value, components, key, seen) for key, value in schema.get("properties", {}).items()}
    if schema_type == "array":
        return [_example(schema.get("items", {}), components, name, seen)]
    if schema_type == "integer":
        return int(schema.get("minimum", 1))
    if schema_type == "number":
        return float(schema.get("minimum", 1.0))
    if schema_type == "boolean":
        return True
    return _string_example(name, schema)


def _add_media_examples(schema: dict[str, Any]) -> None:
    """Attach Swagger-renderable examples to every request and response media type."""
    components = schema.get("components", {}).get("schemas", {})
    for path, path_item in schema.get("paths", {}).items():
        for method, operation in path_item.items():
            if method not in {"get", "post", "put", "patch", "delete"}:
                continue
            operation.setdefault("summary", operation["operationId"].replace("_", " ").title())
            operation.setdefault("description", operation["summary"] + ".")
            operation.setdefault("tags", ["Root"])
            operation["x-request-model"] = "requestBody" if "requestBody" in operation else "Typed path and query parameters"
            for media in operation.get("requestBody", {}).get("content", {}).values():
                media.setdefault("example", _example(media.get("schema", {}), components, "request"))
            successful = next((response for code, response in operation.get("responses", {}).items() if code.startswith("2")), None)
            if successful is not None and path.endswith("/download"):
                successful["content"] = {"application/octet-stream": {"schema": {"type": "string", "format": "binary"}}}
            if successful is not None and path.startswith("/chat/") and path.endswith("/stream"):
                successful["content"] = {"text/event-stream": {"schema": {"type": "string"}}}
            for status_code, response in operation.get("responses", {}).items():
                content = response.get("content", {})
                if not content and status_code != "204":
                    media_type = "text/event-stream" if path.startswith("/chat/") and path.endswith("/stream") else "application/octet-stream"
                    content = response.setdefault("content", {media_type: {"schema": {"type": "string"}}})
                for media_type, media in content.items():
                    if not media.get("schema"):
                        media["schema"] = {"type": "string"}
                    fallback = "data: {\"token\": \"Hello\"}\n\n" if media_type == "text/event-stream" else None
                    media.setdefault("example", fallback or _example(media.get("schema", {}), components, "response"))
                if status_code == "204":
                    response.setdefault("x-example", "No response body")


def configure_openapi(app: FastAPI) -> None:
    """Install deterministic OpenAPI generation while retaining FastAPI's route introspection."""
    def custom_openapi() -> dict[str, Any]:
        if app.openapi_schema is not None:
            return app.openapi_schema
        schema = get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            routes=app.routes,
            tags=OPENAPI_TAGS,
        )
        _add_media_examples(schema)
        app.openapi_schema = schema
        return schema

    app.openapi = custom_openapi
