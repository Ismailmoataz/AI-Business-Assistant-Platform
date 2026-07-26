"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from hmac import compare_digest
from typing import Annotated

from fastapi import FastAPI, Header, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.ai.providers import close_configured_providers
from app.api.routes.auth import router as auth_router
from app.api.routes.business import activity_router, customers_router, employees_router, notes_router, projects_router, tags_router, tasks_router
from app.api.routes.documents import documents_router, folders_router
from app.api.routes.conversations import router as conversations_router
from app.api.routes.chat import router as chat_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.companies import companies_router, departments_router
from app.api.routes.health import router as health_router
from app.api.routes.invitations import router as invitations_router
from app.api.routes.users import router as users_router
from app.config.settings import settings
from app.database.connection import engine
from app.observability import (
    RequestContextMiddleware,
    configure_logging,
    configure_telemetry,
    metrics_payload,
    shutdown_telemetry,
)
from app.openapi import OPENAPI_TAGS, configure_openapi
from app.schemas import ServiceStatusResponse
from app.services.infrastructure import close_infrastructure_clients

configure_logging()


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Initialize telemetry and release process-owned pools without migrating schemas."""
    configure_telemetry()
    try:
        yield
    finally:
        await close_configured_providers()
        close_infrastructure_clients()
        engine.dispose()
        shutdown_telemetry()


app = FastAPI(
    title=settings.app_name,
    description="Tenant-isolated business operations, document retrieval, and AI conversation API.",
    version=settings.service_version,
    lifespan=lifespan,
    openapi_tags=OPENAPI_TAGS,
    docs_url=None if settings.environment == "production" else "/docs",
    redoc_url=None if settings.environment == "production" else "/redoc",
)

if settings.cors_origin_values:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_values,
        allow_credentials=True,
        allow_methods=["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "X-Correlation-ID",
            "X-Request-ID",
        ],
        expose_headers=["X-Correlation-ID", "X-Request-ID"],
        max_age=600,
    )
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_host_values)
app.add_middleware(RequestContextMiddleware, config=settings)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(invitations_router)
app.include_router(companies_router)
app.include_router(departments_router)
app.include_router(employees_router)
app.include_router(customers_router)
app.include_router(projects_router)
app.include_router(tasks_router)
app.include_router(notes_router)
app.include_router(tags_router)
app.include_router(activity_router)
app.include_router(dashboard_router)
app.include_router(folders_router)
app.include_router(documents_router)
app.include_router(conversations_router)
app.include_router(chat_router)
configure_openapi(app)


@app.get("/metrics", include_in_schema=False)
def metrics(
    authorization: Annotated[str | None, Header()] = None,
) -> Response:
    """Expose Prometheus metrics to the deployment's internal monitoring plane."""
    if not settings.metrics_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    metrics_token = (
        settings.metrics_bearer_token.get_secret_value()
        if settings.metrics_bearer_token
        else ""
    )
    if metrics_token:
        scheme, _, credential = (authorization or "").partition(" ")
        if scheme.lower() != "bearer" or not compare_digest(credential, metrics_token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                headers={"WWW-Authenticate": "Bearer"},
            )
    payload, content_type = metrics_payload()
    return Response(content=payload, media_type=content_type)


@app.get("/", tags=["Root"], response_model=ServiceStatusResponse)
def root() -> ServiceStatusResponse:
    """Return a minimal non-sensitive application status."""
    return ServiceStatusResponse(message="AI Business Assistant Platform API is running")
