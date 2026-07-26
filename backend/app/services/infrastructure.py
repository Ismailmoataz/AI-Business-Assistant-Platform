"""External infrastructure client factories."""

from functools import lru_cache

from minio import Minio
from redis import Redis
from redis.backoff import ExponentialBackoff
from redis.retry import Retry
from urllib3 import PoolManager, Retry as HttpRetry, Timeout

from app.config.settings import settings


@lru_cache
def get_redis_client() -> Redis:
    """Return the shared Redis client used by infrastructure features."""
    return Redis(
        host=settings.redis_host,
        port=settings.redis_port,
        db=settings.redis_database,
        password=settings.redis_password.get_secret_value() if settings.redis_password else None,
        ssl=settings.redis_ssl,
        decode_responses=True,
        socket_connect_timeout=settings.redis_connect_timeout_seconds,
        socket_timeout=settings.redis_socket_timeout_seconds,
        socket_keepalive=True,
        health_check_interval=settings.redis_health_check_interval_seconds,
        max_connections=settings.redis_max_connections,
        retry=Retry(
            ExponentialBackoff(
                cap=max(
                    settings.redis_retry_backoff_seconds
                    * (2 ** max(settings.redis_max_retries - 1, 0)),
                    settings.redis_retry_backoff_seconds,
                ),
                base=settings.redis_retry_backoff_seconds,
            ),
            retries=settings.redis_max_retries,
        ),
    )


@lru_cache
def _get_minio_http_client() -> PoolManager:
    """Return the shared bounded HTTP pool used by the MinIO SDK."""
    return PoolManager(
        num_pools=settings.minio_max_connections,
        maxsize=settings.minio_max_connections,
        cert_reqs="CERT_REQUIRED",
        timeout=Timeout(
            connect=settings.minio_connect_timeout_seconds,
            read=settings.minio_read_timeout_seconds,
        ),
        retries=HttpRetry(
            total=settings.minio_max_retries,
            connect=settings.minio_max_retries,
            read=settings.minio_max_retries,
            status=settings.minio_max_retries,
            allowed_methods=frozenset({"DELETE", "GET", "HEAD", "OPTIONS", "POST", "PUT"}),
            status_forcelist=(408, 429, 500, 502, 503, 504),
            backoff_factor=0.2,
            raise_on_status=False,
            respect_retry_after_header=True,
        ),
    )


@lru_cache
def get_minio_client() -> Minio:
    """Return the shared MinIO client used by storage features."""
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key.get_secret_value(),
        secret_key=settings.minio_secret_key.get_secret_value(),
        secure=settings.minio_secure,
        http_client=_get_minio_http_client(),
    )


def close_infrastructure_clients() -> None:
    """Release process-owned Redis and object-storage connection pools."""
    if get_redis_client.cache_info().currsize:
        get_redis_client().close()
    get_redis_client.cache_clear()
    get_minio_client.cache_clear()
    if _get_minio_http_client.cache_info().currsize:
        _get_minio_http_client().clear()
    _get_minio_http_client.cache_clear()
