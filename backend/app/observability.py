"""Vendor-neutral logging, metrics, request context, and trace configuration."""

from __future__ import annotations

import json
import logging
import re
import sys
import time
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from opentelemetry import propagate, trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import Status, StatusCode
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest

from app.config.settings import Settings, settings

request_id_context: ContextVar[str] = ContextVar("request_id", default="-")
correlation_id_context: ContextVar[str] = ContextVar("correlation_id", default="-")

HTTP_REQUESTS = Counter(
    "http_requests_total",
    "Completed API requests.",
    ("method", "route", "status"),
)
HTTP_REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "API request duration.",
    ("method", "route"),
)
HTTP_REQUESTS_IN_PROGRESS = Gauge(
    "http_requests_in_progress",
    "API requests currently being processed.",
    ("method",),
)
DEPENDENCY_HEALTH = Gauge(
    "dependency_health",
    "Dependency readiness (1 healthy, 0 unhealthy).",
    ("dependency",),
)
AI_REQUESTS = Counter(
    "ai_provider_requests_total",
    "AI provider attempts.",
    ("provider", "operation", "outcome"),
)
AI_REQUEST_DURATION = Histogram(
    "ai_provider_request_duration_seconds",
    "AI provider attempt duration.",
    ("provider", "operation"),
)
AI_FAILOVERS = Counter(
    "ai_provider_failovers_total",
    "AI provider failover attempts.",
    ("provider",),
)

_safe_id = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
_telemetry_provider: TracerProvider | None = None


def _trace_id() -> str | None:
    span_context = trace.get_current_span().get_span_context()
    if not span_context.is_valid:
        return None
    return format(span_context.trace_id, "032x")


class ContextFilter(logging.Filter):
    """Attach request and trace context without requiring per-call adapters."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_context.get()
        record.correlation_id = correlation_id_context.get()
        record.trace_id = _trace_id() or "-"
        return True


class JsonFormatter(logging.Formatter):
    """Serialize one log record as a stable JSON object."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
            "correlation_id": getattr(record, "correlation_id", "-"),
            "trace_id": getattr(record, "trace_id", "-"),
        }
        for key in ("method", "route", "status_code", "duration_ms", "provider", "operation"):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def configure_logging(config: Settings = settings) -> None:
    """Configure process logging once with request-context enrichment."""
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(ContextFilter())
    if config.log_format == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s %(levelname)s %(name)s "
                "[request_id=%(request_id)s correlation_id=%(correlation_id)s] %(message)s",
            ),
        )
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(config.log_level)


def configure_telemetry(config: Settings = settings) -> None:
    """Enable OTLP trace export only when explicitly configured."""
    global _telemetry_provider
    if not config.otel_enabled or _telemetry_provider is not None:
        return
    endpoint = (config.otel_exporter_otlp_endpoint or "").rstrip("/")
    if not endpoint.endswith("/v1/traces"):
        endpoint += "/v1/traces"
    provider = TracerProvider(
        resource=Resource.create(
            {
                "service.name": config.otel_service_name,
                "service.version": config.service_version,
                "deployment.environment.name": config.environment,
            },
        ),
    )
    provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint)),
    )
    trace.set_tracer_provider(provider)
    _telemetry_provider = provider


def shutdown_telemetry() -> None:
    """Flush and stop the configured trace provider."""
    global _telemetry_provider
    if _telemetry_provider is not None:
        _telemetry_provider.shutdown()
        _telemetry_provider = None


def metrics_payload() -> tuple[bytes, str]:
    """Return the current Prometheus exposition payload and content type."""
    return generate_latest(), CONTENT_TYPE_LATEST


def set_dependency_health(name: str, healthy: bool) -> None:
    """Record dependency readiness without high-cardinality labels."""
    DEPENDENCY_HEALTH.labels(dependency=name).set(1 if healthy else 0)


def record_ai_request(
    provider: str,
    operation: str,
    outcome: str,
    duration_seconds: float,
) -> None:
    """Record one provider attempt without prompts, payloads, models, or credentials."""
    AI_REQUESTS.labels(provider=provider, operation=operation, outcome=outcome).inc()
    AI_REQUEST_DURATION.labels(provider=provider, operation=operation).observe(duration_seconds)


def record_ai_failover(provider: str) -> None:
    """Record a provider/model failover attempt."""
    AI_FAILOVERS.labels(provider=provider).inc()


def _header(scope: dict[str, Any], name: bytes) -> str | None:
    for key, value in scope.get("headers", []):
        if key.lower() == name:
            return value.decode("latin-1")
    return None


def _safe_request_id(candidate: str | None) -> str:
    if candidate and _safe_id.fullmatch(candidate):
        return candidate
    return str(uuid4())


class RequestContextMiddleware:
    """Propagate request/correlation IDs and emit request metrics and logs."""

    def __init__(self, app: Any, config: Settings = settings) -> None:
        self.app = app
        self.config = config
        self.logger = logging.getLogger("app.http")
        self.tracer = trace.get_tracer("app.http")

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "UNKNOWN")
        request_id = _safe_request_id(_header(scope, b"x-request-id"))
        correlation_id = _safe_request_id(
            _header(scope, b"x-correlation-id") or request_id,
        )
        request_token = request_id_context.set(request_id)
        correlation_token = correlation_id_context.set(correlation_id)
        status_code = 500
        started = time.perf_counter()
        HTTP_REQUESTS_IN_PROGRESS.labels(method=method).inc()
        carrier = {
            key.decode("latin-1"): value.decode("latin-1")
            for key, value in scope.get("headers", [])
        }

        async def send_with_context(message: dict[str, Any]) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = int(message["status"])
                headers = list(message.get("headers", []))
                headers.extend(
                    [
                        (b"x-request-id", request_id.encode("ascii")),
                        (b"x-correlation-id", correlation_id.encode("ascii")),
                    ],
                )
                if self.config.security_headers_enabled:
                    headers.extend(
                        [
                            (b"x-content-type-options", b"nosniff"),
                            (b"x-frame-options", b"DENY"),
                            (b"referrer-policy", b"no-referrer"),
                            (
                                b"permissions-policy",
                                b"camera=(), microphone=(), geolocation=()",
                            ),
                        ],
                    )
                    if self.config.environment in {"staging", "production"}:
                        headers.extend(
                            [
                                (
                                    b"content-security-policy",
                                    b"default-src 'none'; frame-ancestors 'none'",
                                ),
                                (
                                    b"strict-transport-security",
                                    b"max-age=31536000; includeSubDomains",
                                ),
                            ],
                        )
                message["headers"] = headers
            await send(message)

        parent_context = propagate.extract(carrier)
        span_name = f"{method} {scope.get('path', '/')}"
        try:
            with self.tracer.start_as_current_span(span_name, context=parent_context) as span:
                span.set_attribute("http.request.method", method)
                span.set_attribute("url.path", scope.get("path", "/"))
                try:
                    await self.app(scope, receive, send_with_context)
                except Exception as exc:
                    span.set_status(Status(StatusCode.ERROR))
                    span.record_exception(exc)
                    self.logger.exception("Unhandled request failure")
                    raise
                finally:
                    route_object = scope.get("route")
                    route = getattr(route_object, "path", None) or "unmatched"
                    span.update_name(f"{method} {route}")
                    span.set_attribute("http.route", route)
                    span.set_attribute("http.response.status_code", status_code)
        finally:
            route_object = scope.get("route")
            route = getattr(route_object, "path", None) or "unmatched"
            duration = time.perf_counter() - started
            HTTP_REQUESTS_IN_PROGRESS.labels(method=method).dec()
            HTTP_REQUESTS.labels(method=method, route=route, status=str(status_code)).inc()
            HTTP_REQUEST_DURATION.labels(method=method, route=route).observe(duration)
            self.logger.info(
                "Request completed",
                extra={
                    "method": method,
                    "route": route,
                    "status_code": status_code,
                    "duration_ms": round(duration * 1000, 2),
                },
            )
            request_id_context.reset(request_token)
            correlation_id_context.reset(correlation_token)
