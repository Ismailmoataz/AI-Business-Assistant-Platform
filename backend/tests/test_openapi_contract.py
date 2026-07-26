"""Contract tests for complete and stable public OpenAPI documentation."""

import json
import warnings
from typing import Any

from app.main import app


HTTP_METHODS = {"get", "post", "put", "patch", "delete"}


def _operations(schema: dict[str, Any]):
    for path, path_item in schema["paths"].items():
        for method, operation in path_item.items():
            if method in HTTP_METHODS:
                yield path, method, operation


def test_openapi_generation_is_warning_free_and_json_serializable() -> None:
    """The public contract must generate deterministically without framework warnings."""
    app.openapi_schema = None
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        schema = app.openapi()

    assert caught == []
    assert schema["openapi"].startswith("3.1.")
    assert json.loads(json.dumps(schema)) == schema
    assert len(schema["paths"]) == 52
    assert sum(1 for _ in _operations(schema)) == 76


def test_every_operation_has_complete_swagger_metadata_and_examples() -> None:
    """Every endpoint exposes grouping, narrative, typed I/O, statuses, and examples."""
    schema = app.openapi()
    declared_tags = {tag["name"] for tag in schema["tags"]}

    for path, method, operation in _operations(schema):
        identity = f"{method.upper()} {path}"
        assert operation.get("summary"), identity
        assert operation.get("description"), identity
        assert operation.get("tags") and set(operation["tags"]) <= declared_tags, identity
        assert operation.get("x-request-model"), identity
        assert operation.get("responses"), identity
        for media in operation.get("requestBody", {}).get("content", {}).values():
            assert media.get("schema"), identity
            assert "example" in media or "examples" in media, identity
        for status_code, response in operation["responses"].items():
            assert status_code.isdigit() or status_code == "default", identity
            assert response.get("description"), identity
            if response.get("content"):
                for media in response["content"].values():
                    assert media.get("schema"), identity
                    assert "example" in media or "examples" in media, identity
            elif status_code == "204":
                assert response.get("x-example") == "No response body", identity


def test_component_schemas_are_unique_and_all_references_resolve() -> None:
    """Components use unambiguous names and contain no dangling schema references."""
    schema = app.openapi()
    components = schema["components"]["schemas"]
    assert "app__schemas__auth__MessageResponse" not in components
    assert "app__schemas__conversations__MessageResponse" not in components
    assert "MessageResponse" in components
    assert "OperationMessageResponse" in components

    def check(value: Any) -> None:
        if isinstance(value, dict):
            reference = value.get("$ref")
            if reference and reference.startswith("#/components/schemas/"):
                assert reference.rsplit("/", 1)[-1] in components
            for nested in value.values():
                check(nested)
        elif isinstance(value, list):
            for nested in value:
                check(nested)

    check(schema)
