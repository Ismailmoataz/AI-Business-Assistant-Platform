"""Independent chat and embedding provider interfaces and resilient implementations."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import httpx
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

from app.config.settings import Settings, settings
from app.observability import record_ai_failover, record_ai_request

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)

RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}


class AIProviderError(RuntimeError):
    """Base error for safe AI provider failures."""


class AIProviderConfigurationError(AIProviderError):
    """Raised when the selected provider lacks required configuration."""


@dataclass(frozen=True)
class ChatResult:
    """Normalized response returned by a chat provider."""

    text: str
    input_tokens: int | None = None
    output_tokens: int | None = None


class ChatProvider(ABC):
    """Vendor-neutral asynchronous chat and streaming contract."""

    @abstractmethod
    async def complete(self, messages: list[dict[str, str]]) -> ChatResult: ...

    @abstractmethod
    def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]: ...

    @abstractmethod
    async def health_check(self) -> None: ...

    async def close(self) -> None:
        """Release provider resources when the implementation owns any."""


class EmbeddingProvider(ABC):
    """Vendor-neutral batch embedding contract."""

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]: ...

    @abstractmethod
    async def health_check(self) -> None: ...

    async def close(self) -> None:
        """Release provider resources when the implementation owns any."""


class ResilientHttpProvider:
    """Shared bounded connection pooling, retry, and observability for HTTP providers."""

    provider_name = "unknown"

    def __init__(self, base_url: str, config: Settings) -> None:
        self.config = config
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=httpx.Timeout(
                timeout=config.ai_timeout_seconds,
                connect=config.ai_connect_timeout_seconds,
                pool=config.ai_pool_timeout_seconds,
            ),
            limits=httpx.Limits(
                max_connections=config.ai_max_connections,
                max_keepalive_connections=config.ai_max_keepalive_connections,
            ),
            follow_redirects=False,
        )

    async def close(self) -> None:
        """Close the shared HTTP connection pool."""
        await self._client.aclose()

    def _retry_delay(self, attempt: int, response: httpx.Response | None = None) -> float:
        retry_after = response.headers.get("Retry-After") if response is not None else None
        if retry_after:
            try:
                return min(float(retry_after), 30.0)
            except ValueError:
                pass
        return min(self.config.ai_retry_backoff_seconds * (2**attempt), 10.0)

    async def _post(
        self,
        path: str,
        *,
        operation: str,
        headers: dict[str, str],
        body: dict[str, Any],
    ) -> httpx.Response:
        last_error: Exception | None = None
        for attempt in range(self.config.ai_max_retries + 1):
            started = time.perf_counter()
            response: httpx.Response | None = None
            with tracer.start_as_current_span(f"ai.{self.provider_name}.{operation}") as span:
                span.set_attribute("gen_ai.system", self.provider_name)
                span.set_attribute("gen_ai.operation.name", operation)
                span.set_attribute("ai.retry_attempt", attempt)
                try:
                    response = await self._client.post(path, json=body, headers=headers)
                    span.set_attribute("http.response.status_code", response.status_code)
                    if response.status_code in RETRYABLE_STATUS_CODES:
                        raise httpx.HTTPStatusError(
                            "Retryable provider response",
                            request=response.request,
                            response=response,
                        )
                    response.raise_for_status()
                    record_ai_request(
                        self.provider_name,
                        operation,
                        "success",
                        time.perf_counter() - started,
                    )
                    return response
                except (httpx.TransportError, httpx.HTTPStatusError) as exc:
                    last_error = exc
                    retryable = isinstance(exc, httpx.TransportError) or (
                        response is not None
                        and response.status_code in RETRYABLE_STATUS_CODES
                    )
                    can_retry = retryable and attempt < self.config.ai_max_retries
                    outcome = "retry" if can_retry else "error"
                    record_ai_request(
                        self.provider_name,
                        operation,
                        outcome,
                        time.perf_counter() - started,
                    )
                    span.set_status(Status(StatusCode.ERROR))
                    if not can_retry:
                        break
                    logger.warning(
                        "Retrying AI provider request",
                        extra={
                            "provider": self.provider_name,
                            "operation": operation,
                        },
                    )
                    await asyncio.sleep(self._retry_delay(attempt, response))
        raise AIProviderError(
            f"{self.provider_name} {operation} request failed",
        ) from last_error

    async def _stream_response(
        self,
        path: str,
        *,
        operation: str,
        headers: dict[str, str],
        body: dict[str, Any],
    ) -> AsyncIterator[str]:
        last_error: Exception | None = None
        for attempt in range(self.config.ai_max_retries + 1):
            started = time.perf_counter()
            response: httpx.Response | None = None
            yielded = False
            try:
                with tracer.start_as_current_span(
                    f"ai.{self.provider_name}.{operation}",
                ) as span:
                    span.set_attribute("gen_ai.system", self.provider_name)
                    span.set_attribute("gen_ai.operation.name", operation)
                    span.set_attribute("ai.retry_attempt", attempt)
                    async with self._client.stream(
                        "POST",
                        path,
                        json=body,
                        headers=headers,
                    ) as response:
                        span.set_attribute("http.response.status_code", response.status_code)
                        if response.status_code in RETRYABLE_STATUS_CODES:
                            raise httpx.HTTPStatusError(
                                "Retryable provider response",
                                request=response.request,
                                response=response,
                            )
                        response.raise_for_status()
                        async for line in response.aiter_lines():
                            yielded = True
                            yield line
                        record_ai_request(
                            self.provider_name,
                            operation,
                            "success",
                            time.perf_counter() - started,
                        )
                    return
            except (httpx.TransportError, httpx.HTTPStatusError) as exc:
                last_error = exc
                retryable = not yielded and (
                    isinstance(exc, httpx.TransportError)
                    or (
                        response is not None
                        and response.status_code in RETRYABLE_STATUS_CODES
                    )
                )
                can_retry = retryable and attempt < self.config.ai_max_retries
                record_ai_request(
                    self.provider_name,
                    operation,
                    "retry" if can_retry else "error",
                    time.perf_counter() - started,
                )
                if not can_retry:
                    break
                logger.warning(
                    "Retrying AI provider stream",
                    extra={
                        "provider": self.provider_name,
                        "operation": operation,
                    },
                )
                await asyncio.sleep(self._retry_delay(attempt, response))
        raise AIProviderError(
            f"{self.provider_name} {operation} stream failed",
        ) from last_error


class MetaChatProvider(ResilientHttpProvider, ChatProvider):
    """Official Llama API chat-completions provider."""

    provider_name = "meta"

    def __init__(
        self,
        config: Settings = settings,
        *,
        model: str | None = None,
    ) -> None:
        selected_model = model or config.chat_model
        if not config.meta_api_key or not selected_model:
            raise AIProviderConfigurationError(
                "Meta chat requires META_API_KEY and CHAT_MODEL",
            )
        super().__init__(config.meta_base_url, config)
        self._api_key = config.meta_api_key.get_secret_value()
        self._model = selected_model

    @property
    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}"}

    async def complete(self, messages: list[dict[str, str]]) -> ChatResult:
        response = await self._post(
            "/chat/completions",
            operation="chat",
            headers=self._headers,
            body={"model": self._model, "messages": messages},
        )
        try:
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            if not isinstance(content, str) or not content.strip():
                raise ValueError("empty completion")
            usage = data.get("usage", {})
            return ChatResult(
                content,
                usage.get("prompt_tokens"),
                usage.get("completion_tokens"),
            )
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise AIProviderError("Meta returned an invalid chat response") from exc

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        lines = self._stream_response(
            "/chat/completions",
            operation="chat_stream",
            headers=self._headers,
            body={"model": self._model, "messages": messages, "stream": True},
        )
        try:
            async for line in lines:
                if not line.startswith("data: ") or line == "data: [DONE]":
                    continue
                data = json.loads(line[6:])
                delta = data["choices"][0].get("delta", {}).get("content")
                if delta:
                    yield str(delta)
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise AIProviderError("Meta returned an invalid chat stream") from exc

    async def health_check(self) -> None:
        await self.complete([{"role": "user", "content": "ping"}])


class OpenAIEmbeddingProvider(ResilientHttpProvider, EmbeddingProvider):
    """Configured OpenAI embeddings provider, independent from chat selection."""

    provider_name = "openai"

    def __init__(self, config: Settings = settings) -> None:
        if not config.openai_api_key or not config.embedding_model:
            raise AIProviderConfigurationError(
                "OpenAI embeddings require OPENAI_API_KEY and EMBEDDING_MODEL",
            )
        super().__init__(config.openai_base_url, config)
        self._api_key = config.openai_api_key.get_secret_value()
        self._model = config.embedding_model

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        response = await self._post(
            "/embeddings",
            operation="embed",
            headers={"Authorization": f"Bearer {self._api_key}"},
            body={"model": self._model, "input": texts},
        )
        try:
            data = response.json()["data"]
            ordered = sorted(data, key=lambda item: item.get("index", 0))
            vectors = [item["embedding"] for item in ordered]
            if not all(isinstance(vector, list) for vector in vectors):
                raise ValueError("invalid embedding vector")
            return vectors
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise AIProviderError("OpenAI returned an invalid embedding response") from exc

    async def health_check(self) -> None:
        await self.embed(["health check"])


class FailoverChatProvider(ChatProvider):
    """Fail over before output starts, avoiding duplicate partial streams."""

    def __init__(self, providers: list[ChatProvider]) -> None:
        if not providers:
            raise AIProviderConfigurationError("At least one chat provider is required")
        self._providers = providers

    async def complete(self, messages: list[dict[str, str]]) -> ChatResult:
        last_error: AIProviderError | None = None
        for index, provider in enumerate(self._providers):
            try:
                return await provider.complete(messages)
            except AIProviderError as exc:
                last_error = exc
                if index == len(self._providers) - 1:
                    break
                provider_name = getattr(provider, "provider_name", provider.__class__.__name__)
                record_ai_failover(str(provider_name))
                logger.warning("Failing over chat completion", extra={"provider": provider_name})
        raise AIProviderError("All configured chat providers failed") from last_error

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        last_error: AIProviderError | None = None
        for index, provider in enumerate(self._providers):
            yielded = False
            try:
                async for token in provider.stream(messages):
                    yielded = True
                    yield token
                return
            except AIProviderError as exc:
                last_error = exc
                if yielded or index == len(self._providers) - 1:
                    break
                provider_name = getattr(provider, "provider_name", provider.__class__.__name__)
                record_ai_failover(str(provider_name))
                logger.warning("Failing over chat stream", extra={"provider": provider_name})
        raise AIProviderError("All configured chat providers failed") from last_error

    async def health_check(self) -> None:
        await self._providers[0].health_check()

    async def close(self) -> None:
        await asyncio.gather(*(provider.close() for provider in self._providers))


@lru_cache(maxsize=1)
def _default_chat_provider() -> ChatProvider:
    return ProviderFactory._build_chat(settings)


@lru_cache(maxsize=1)
def _default_embedding_provider() -> EmbeddingProvider:
    return ProviderFactory._build_embeddings(settings)


class ProviderFactory:
    """Create independently configured chat and embedding providers."""

    @staticmethod
    def _build_chat(config: Settings) -> ChatProvider:
        if config.effective_chat_provider != "meta":
            raise AIProviderConfigurationError(
                f"Unsupported chat provider: {config.effective_chat_provider or 'unset'}",
            )
        providers: list[ChatProvider] = [MetaChatProvider(config)]
        if (
            config.chat_fallback_model
            and config.chat_fallback_model != config.chat_model
        ):
            providers.append(MetaChatProvider(config, model=config.chat_fallback_model))
        return providers[0] if len(providers) == 1 else FailoverChatProvider(providers)

    @staticmethod
    def _build_embeddings(config: Settings) -> EmbeddingProvider:
        if (config.embedding_provider or "").lower() == "openai":
            return OpenAIEmbeddingProvider(config)
        raise AIProviderConfigurationError(
            f"Unsupported embedding provider: {config.embedding_provider or 'unset'}",
        )

    @staticmethod
    def chat(config: Settings = settings) -> ChatProvider:
        return _default_chat_provider() if config is settings else ProviderFactory._build_chat(config)

    @staticmethod
    def embeddings(config: Settings = settings) -> EmbeddingProvider:
        return (
            _default_embedding_provider()
            if config is settings
            else ProviderFactory._build_embeddings(config)
        )


async def close_configured_providers() -> None:
    """Release cached provider connection pools during application shutdown."""
    providers: list[ChatProvider | EmbeddingProvider] = []
    if _default_chat_provider.cache_info().currsize:
        providers.append(_default_chat_provider())
    if _default_embedding_provider.cache_info().currsize:
        providers.append(_default_embedding_provider())
    if providers:
        await asyncio.gather(*(provider.close() for provider in providers))
    _default_chat_provider.cache_clear()
    _default_embedding_provider.cache_clear()
