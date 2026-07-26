"""Typed application configuration loaded from environment variables."""

from ipaddress import ip_network
from typing import Literal
from urllib.parse import urlparse

from pydantic import AliasChoices, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for application and production infrastructure."""

    app_name: str = Field(
        default="AI Business Assistant Platform",
        validation_alias=AliasChoices("APP_NAME", "PROJECT_NAME"),
    )
    service_version: str = "1.0.0"
    environment: Literal["local", "development", "test", "staging", "production"] = "local"

    database_url: str = Field(repr=False)
    database_echo: bool = False
    database_pool_size: int = Field(default=10, ge=1, le=100)
    database_max_overflow: int = Field(default=20, ge=0, le=200)
    database_pool_timeout_seconds: int = Field(default=30, ge=1, le=120)
    database_pool_recycle_seconds: int = Field(default=1800, ge=60, le=86400)
    database_connect_timeout_seconds: int = Field(default=5, ge=1, le=60)

    redis_host: str = "redis"
    redis_port: int = Field(default=6379, ge=1, le=65535)
    redis_database: int = Field(default=0, ge=0, le=15)
    redis_password: SecretStr | None = None
    redis_ssl: bool = False
    redis_connect_timeout_seconds: float = Field(default=3, ge=0.1, le=30)
    redis_socket_timeout_seconds: float = Field(default=3, ge=0.1, le=30)
    redis_health_check_interval_seconds: int = Field(default=30, ge=1, le=300)
    redis_max_connections: int = Field(default=50, ge=1, le=500)
    redis_max_retries: int = Field(default=3, ge=0, le=10)
    redis_retry_backoff_seconds: float = Field(default=0.2, ge=0, le=5)

    minio_endpoint: str = "minio:9000"
    minio_access_key: SecretStr = Field(
        validation_alias=AliasChoices("MINIO_ACCESS_KEY", "MINIO_ROOT_USER"),
    )
    minio_secret_key: SecretStr = Field(
        validation_alias=AliasChoices("MINIO_SECRET_KEY", "MINIO_ROOT_PASSWORD"),
    )
    minio_secure: bool = False
    minio_documents_bucket: str = Field(
        default="company-documents",
        pattern=r"^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$",
    )
    minio_connect_timeout_seconds: float = Field(default=3, ge=0.1, le=30)
    minio_read_timeout_seconds: float = Field(default=30, ge=1, le=300)
    minio_max_connections: int = Field(default=20, ge=1, le=200)
    minio_max_retries: int = Field(default=3, ge=0, le=10)
    document_max_upload_bytes: int = Field(
        default=25 * 1024 * 1024,
        ge=1,
        le=250 * 1024 * 1024,
    )
    document_signed_url_expiry_seconds: int = Field(default=300, ge=60, le=3600)

    jwt_secret_key: SecretStr
    jwt_algorithm: Literal["HS256", "HS384", "HS512"] = "HS256"
    jwt_issuer: str = "ai-business-assistant"
    jwt_audience: str = "ai-business-assistant-api"
    access_token_expire_minutes: int = Field(
        default=15,
        ge=1,
        le=60,
        validation_alias=AliasChoices(
            "ACCESS_TOKEN_EXPIRE_MINUTES",
            "JWT_ACCESS_TOKEN_EXPIRE_MINUTES",
        ),
    )
    refresh_token_expire_days: int = Field(
        default=7,
        ge=1,
        le=30,
        validation_alias=AliasChoices(
            "REFRESH_TOKEN_EXPIRE_DAYS",
            "JWT_REFRESH_TOKEN_EXPIRE_DAYS",
        ),
    )
    password_reset_expire_minutes: int = Field(default=30, ge=5, le=120)
    invitation_expire_days: int = Field(default=7, ge=1, le=30)
    password_min_length: int = Field(default=12, ge=12, le=128)
    cookie_secure: bool = True
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    cookie_domain: str | None = None

    allowed_hosts: str = "localhost,127.0.0.1,testserver"
    cors_allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    security_headers_enabled: bool = True

    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    log_format: Literal["console", "json"] = "console"
    forwarded_allow_ips: str = "127.0.0.1"
    metrics_enabled: bool = True
    metrics_bearer_token: SecretStr | None = None
    otel_enabled: bool = False
    otel_service_name: str = "ai-business-assistant-api"
    otel_exporter_otlp_endpoint: str | None = None

    google_client_id: str | None = None
    google_client_secret: SecretStr | None = None
    google_redirect_uri: str | None = None
    chat_provider: str | None = None
    embedding_provider: str | None = None
    llm_provider: str | None = None
    meta_api_key: SecretStr | None = None
    meta_base_url: str = "https://api.llama.com/v1"
    openai_api_key: SecretStr | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    chat_model: str | None = None
    chat_fallback_model: str | None = None
    embedding_model: str | None = None
    ai_connect_timeout_seconds: float = Field(default=5, ge=0.1, le=60)
    ai_timeout_seconds: float = Field(default=30, ge=1, le=300)
    ai_pool_timeout_seconds: float = Field(default=5, ge=0.1, le=60)
    ai_max_connections: int = Field(default=50, ge=1, le=500)
    ai_max_keepalive_connections: int = Field(default=20, ge=0, le=200)
    ai_max_retries: int = Field(default=2, ge=0, le=5)
    ai_retry_backoff_seconds: float = Field(default=0.5, ge=0, le=10)
    chunk_size: int = Field(default=1000, ge=100, le=10000)
    chunk_overlap: int = Field(default=150, ge=0, le=5000)
    embedding_batch_size: int = Field(default=32, ge=1, le=2048)
    top_k: int = Field(default=8, ge=1, le=100)
    max_context_size: int = Field(default=12000, ge=500, le=100000)
    minimum_similarity_score: float = Field(default=0.2, ge=-1, le=1)
    ai_system_prompt: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        """Ensure the application uses the supported PostgreSQL driver."""
        if not value.startswith(("postgresql://", "postgresql+psycopg2://")):
            raise ValueError("DATABASE_URL must use PostgreSQL with psycopg2")
        return value

    @field_validator("allowed_hosts", "cors_allowed_origins", "forwarded_allow_ips")
    @classmethod
    def normalize_comma_separated_values(cls, value: str) -> str:
        """Normalize comma-delimited operational allowlists."""
        return ",".join(part.strip() for part in value.split(",") if part.strip())

    @staticmethod
    def _is_weak_secret(value: str) -> bool:
        normalized = value.strip().lower()
        weak_markers = (
            "change_me",
            "changeme",
            "example",
            "minioadmin",
            "password",
            "placeholder",
            "<",
            ">",
        )
        return not normalized or any(marker in normalized for marker in weak_markers)

    @model_validator(mode="after")
    def validate_configuration(self) -> "Settings":
        """Reject inconsistent provider settings and unsafe production defaults."""
        if self.cookie_samesite == "none" and not self.cookie_secure:
            raise ValueError("COOKIE_SECURE must be enabled when COOKIE_SAMESITE is none")
        if self.otel_enabled and not self.otel_exporter_otlp_endpoint:
            raise ValueError("OTEL_EXPORTER_OTLP_ENDPOINT is required when OTEL_ENABLED is true")
        if self.effective_chat_provider == "meta" and (
            not self.meta_api_key or not self.chat_model
        ):
            raise ValueError("Meta chat requires META_API_KEY and CHAT_MODEL")
        if (self.embedding_provider or "").lower() == "openai" and (
            not self.openai_api_key or not self.embedding_model
        ):
            raise ValueError("OpenAI embeddings require OPENAI_API_KEY and EMBEDDING_MODEL")
        if self.environment not in {"staging", "production"}:
            return self

        database_password = urlparse(self.database_url).password or ""
        required_secrets = (
            database_password,
            self.redis_password.get_secret_value() if self.redis_password else "",
            self.minio_access_key.get_secret_value(),
            self.minio_secret_key.get_secret_value(),
            self.jwt_secret_key.get_secret_value(),
        )
        if any(self._is_weak_secret(secret) or len(secret) < 32 for secret in required_secrets):
            raise ValueError(
                "staging and production database, Redis, MinIO, and JWT credentials must be "
                "non-default and at least 32 characters",
            )
        if self.database_echo:
            raise ValueError("DATABASE_ECHO must be disabled in staging and production")
        if self.log_format != "json":
            raise ValueError("LOG_FORMAT must be json in staging and production")
        if "*" in self.allowed_host_values or not self.allowed_host_values:
            raise ValueError("ALLOWED_HOSTS must contain explicit hosts in staging and production")
        if "*" in self.cors_origin_values or not self.cors_origin_values:
            raise ValueError(
                "CORS_ALLOWED_ORIGINS must contain explicit origins in staging and production",
            )
        try:
            for value in self.forwarded_ip_values:
                ip_network(value, strict=False)
        except ValueError as exc:
            raise ValueError(
                "FORWARDED_ALLOW_IPS must contain only trusted IP addresses or CIDRs",
            ) from exc
        if not self.forwarded_ip_values:
            raise ValueError("FORWARDED_ALLOW_IPS cannot be empty in staging and production")
        if not self.cookie_secure:
            raise ValueError("COOKIE_SECURE must be enabled in staging and production")
        for base_url in (self.meta_base_url, self.openai_base_url):
            if not base_url.startswith("https://"):
                raise ValueError("AI provider base URLs must use HTTPS in staging and production")
        return self

    @property
    def allowed_host_values(self) -> list[str]:
        """Return the configured trusted-host allowlist."""
        return [value for value in self.allowed_hosts.split(",") if value]

    @property
    def cors_origin_values(self) -> list[str]:
        """Return the configured browser-origin allowlist."""
        return [value for value in self.cors_allowed_origins.split(",") if value]

    @property
    def forwarded_ip_values(self) -> list[str]:
        """Return trusted reverse-proxy IP addresses or networks."""
        return [value for value in self.forwarded_allow_ips.split(",") if value]

    @property
    def effective_chat_provider(self) -> str:
        """Resolve CHAT_PROVIDER with legacy LLM_PROVIDER compatibility."""
        return (self.chat_provider or self.llm_provider or "").lower()


settings = Settings()  # type: ignore[call-arg]
