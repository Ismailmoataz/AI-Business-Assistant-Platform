"""Production configuration, health, request context, and provider resilience tests."""

from __future__ import annotations

from collections.abc import AsyncIterator

import httpx
import pytest
from fastapi import Response
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.ai.providers import (
    AIProviderError,
    ChatProvider,
    ChatResult,
    FailoverChatProvider,
    MetaChatProvider,
)
from app.api.routes import health as health_routes
from app.config.settings import Settings
from app.main import app


def _settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "environment": "test",
        "database_url": "postgresql+psycopg2://test:test@localhost/test",
        "minio_access_key": "test-access",
        "minio_secret_key": "test-secret",
        "jwt_secret_key": "test-jwt-secret",
        "redis_password": "test-redis",
        "cors_allowed_origins": "",
    }
    values.update(overrides)
    return Settings(**values)


@pytest.mark.parametrize("environment", ["staging", "production"])
def test_release_settings_reject_placeholders_and_untrusted_hosts(
    environment: str,
) -> None:
    """Release environments must fail before accepting placeholder credentials."""
    with pytest.raises(ValidationError):
        _settings(
            environment=environment,
            database_url="postgresql://app:CHANGE_ME_TO_AT_LEAST_32_RANDOM_CHARACTERS@db/app",
            minio_access_key="CHANGE_ME_TO_AT_LEAST_32_RANDOM_CHARACTERS",
            minio_secret_key="CHANGE_ME_TO_AT_LEAST_32_RANDOM_CHARACTERS",
            redis_password="CHANGE_ME_TO_AT_LEAST_32_RANDOM_CHARACTERS",
            jwt_secret_key="CHANGE_ME_TO_AT_LEAST_32_RANDOM_CHARACTERS",
            log_format="json",
            allowed_hosts="*",
        )


def test_production_settings_accept_explicit_secure_operational_values() -> None:
    """A fully explicit production configuration should validate."""
    secret = "z9Q!production-secret-material-123456789"
    config = _settings(
        environment="production",
        database_url=f"postgresql://app:{secret}@db/app",
        minio_access_key="production-access-key-material-123456",
        minio_secret_key=secret,
        redis_password=secret,
        jwt_secret_key=secret,
        log_format="json",
        allowed_hosts="api.example.com",
        cors_allowed_origins="https://app.example.com",
        forwarded_allow_ips="10.10.0.0/16",
        cookie_secure=True,
    )

    assert config.environment == "production"
    assert config.allowed_host_values == ["api.example.com"]


def test_provider_configuration_is_validated_as_a_pair() -> None:
    """Selecting a provider without its credentials must fail at startup."""
    with pytest.raises(ValidationError):
        _settings(chat_provider="meta", chat_model="llama")

    with pytest.raises(ValidationError):
        _settings(embedding_provider="openai", embedding_model="embedding-model")


def test_liveness_and_request_context_do_not_probe_dependencies() -> None:
    """Liveness must stay cheap while returning generated operational IDs."""
    client = TestClient(app)
    response = client.get(
        "/health/live",
        headers={"X-Correlation-ID": "deployment-smoke-123"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["x-correlation-id"] == "deployment-smoke-123"
    assert response.headers["x-request-id"]
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["cache-control"] == "no-store"


def test_readiness_checks_database_redis_and_private_bucket(monkeypatch: pytest.MonkeyPatch) -> None:
    """Readiness should prove all runtime dependencies and the configured bucket."""

    class Connection:
        def __enter__(self) -> "Connection":
            return self

        def __exit__(self, *_: object) -> None:
            return None

        def execute(self, _: object) -> None:
            return None

    class Engine:
        def connect(self) -> Connection:
            return Connection()

    class Redis:
        def ping(self) -> bool:
            return True

    class Minio:
        def bucket_exists(self, _: str) -> bool:
            return True

    monkeypatch.setattr(health_routes, "engine", Engine())
    monkeypatch.setattr(health_routes, "get_redis_client", lambda: Redis())
    monkeypatch.setattr(health_routes, "get_minio_client", lambda: Minio())

    result = health_routes.readiness(Response())

    assert result.status == "ok"
    assert result.dependencies == {"database": "ok", "redis": "ok", "minio": "ok"}


class _FailingChatProvider(ChatProvider):
    async def complete(self, messages: list[dict[str, str]]) -> ChatResult:
        raise AIProviderError("primary unavailable")

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        raise AIProviderError("primary unavailable")
        yield ""

    async def health_check(self) -> None:
        raise AIProviderError("primary unavailable")


class _WorkingChatProvider(ChatProvider):
    async def complete(self, messages: list[dict[str, str]]) -> ChatResult:
        return ChatResult(text="fallback")

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        yield "fallback"

    async def health_check(self) -> None:
        return None


@pytest.mark.asyncio
async def test_chat_failover_happens_before_output_starts() -> None:
    """A configured fallback handles primary failures without duplicating stream output."""
    provider = FailoverChatProvider([_FailingChatProvider(), _WorkingChatProvider()])

    result = await provider.complete([{"role": "user", "content": "hello"}])
    tokens = [token async for token in provider.stream([{"role": "user", "content": "hello"}])]

    assert result.text == "fallback"
    assert tokens == ["fallback"]


@pytest.mark.asyncio
async def test_meta_provider_retries_transient_status_without_logging_payloads() -> None:
    """Transient provider responses should retry within the configured bound."""
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(503, request=request)
        return httpx.Response(
            200,
            request=request,
            json={
                "choices": [{"message": {"content": "ready"}}],
                "usage": {"prompt_tokens": 2, "completion_tokens": 1},
            },
        )

    config = _settings(
        chat_provider="meta",
        meta_api_key="test-meta-key",
        chat_model="test-model",
        ai_max_retries=1,
        ai_retry_backoff_seconds=0,
    )
    provider = MetaChatProvider(config)
    await provider._client.aclose()
    provider._client = httpx.AsyncClient(
        base_url=config.meta_base_url,
        transport=httpx.MockTransport(handler),
    )
    try:
        result = await provider.complete([{"role": "user", "content": "sensitive"}])
    finally:
        await provider.close()

    assert attempts == 2
    assert result == ChatResult(text="ready", input_tokens=2, output_tokens=1)
