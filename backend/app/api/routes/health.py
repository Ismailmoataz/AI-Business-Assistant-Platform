"""Operational readiness endpoint."""

import logging
from typing import Literal, cast

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config.settings import settings
from app.database.connection import engine
from app.observability import set_dependency_health
from app.schemas import HealthResponse, LivenessResponse
from app.services.infrastructure import get_minio_client, get_redis_client

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Health"])


@router.get("/health/live", response_model=LivenessResponse)
def liveness(response: Response) -> LivenessResponse:
    """Report process liveness without calling external dependencies."""
    response.headers["Cache-Control"] = "no-store"
    return LivenessResponse(status="ok")


@router.get("/health/ready", response_model=HealthResponse)
@router.get("/health", response_model=HealthResponse)
def readiness(response: Response) -> HealthResponse:
    """Report readiness only when required dependencies and the storage bucket respond."""
    response.headers["Cache-Control"] = "no-store"
    dependencies: dict[str, str] = {}

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        dependencies["database"] = "ok"
        set_dependency_health("database", True)
    except SQLAlchemyError:
        logger.warning("Database health check failed", exc_info=True)
        dependencies["database"] = "unavailable"
        set_dependency_health("database", False)

    try:
        get_redis_client().ping()
        dependencies["redis"] = "ok"
        set_dependency_health("redis", True)
    except Exception:
        logger.warning("Redis health check failed", exc_info=True)
        dependencies["redis"] = "unavailable"
        set_dependency_health("redis", False)

    try:
        bucket_ready = get_minio_client().bucket_exists(settings.minio_documents_bucket)
        dependencies["minio"] = "ok" if bucket_ready else "unavailable"
        set_dependency_health("minio", bucket_ready)
    except Exception:
        logger.warning("MinIO health check failed", exc_info=True)
        dependencies["minio"] = "unavailable"
        set_dependency_health("minio", False)

    if any(value != "ok" for value in dependencies.values()):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail={"status": "unhealthy", "dependencies": dependencies})

    return HealthResponse(
        status="ok",
        dependencies=cast(dict[str, Literal["ok"]], dependencies),
    )
