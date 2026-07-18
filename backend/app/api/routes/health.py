import logging

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database.connection import engine
from app.services.infrastructure import get_minio_client, get_redis_client

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Health"])


@router.get("/health")
def health() -> dict[str, object]:
    dependencies: dict[str, str] = {}

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        dependencies["database"] = "ok"
    except SQLAlchemyError:
        logger.exception("Database health check failed")
        dependencies["database"] = "unavailable"

    try:
        get_redis_client().ping()
        dependencies["redis"] = "ok"
    except Exception:
        logger.exception("Redis health check failed")
        dependencies["redis"] = "unavailable"

    try:
        get_minio_client().list_buckets()
        dependencies["minio"] = "ok"
    except Exception:
        logger.exception("MinIO health check failed")
        dependencies["minio"] = "unavailable"

    if any(value != "ok" for value in dependencies.values()):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "unhealthy", "dependencies": dependencies},
        )

    return {"status": "ok", "dependencies": dependencies}
