from typing import Literal

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = Field(
        default="AI Business Assistant Platform",
        validation_alias=AliasChoices("APP_NAME", "PROJECT_NAME"),
    )
    environment: Literal["development", "staging", "production"] = "development"
    database_url: str
    database_echo: bool = False
    redis_host: str = "redis"
    redis_port: int = Field(default=6379, ge=1, le=65535)
    minio_endpoint: str = "minio:9000"
    minio_access_key: str = Field(
        validation_alias=AliasChoices("MINIO_ACCESS_KEY", "MINIO_ROOT_USER")
    )
    minio_secret_key: str = Field(
        validation_alias=AliasChoices("MINIO_SECRET_KEY", "MINIO_ROOT_PASSWORD")
    )
    minio_secure: bool = False
    jwt_secret_key: str

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        case_sensitive=False,
    )

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        if not value.startswith(("postgresql://", "postgresql+psycopg2://")):
            raise ValueError("DATABASE_URL must use PostgreSQL with psycopg2")
        return value

    @model_validator(mode="after")
    def reject_insecure_production_configuration(self) -> "Settings":
        if self.environment != "production":
            return self

        insecure_values = {
            "change_me_to_a_long_random_secret",
            "minioadmin",
            "admin",
            "postgres",
        }
        configured_values = {
            self.minio_access_key.lower(),
            self.minio_secret_key.lower(),
            self.jwt_secret_key.lower(),
        }
        if configured_values.intersection(insecure_values) or len(self.jwt_secret_key) < 32:
            raise ValueError("production credentials must be non-default and sufficiently long")
        if self.database_echo:
            raise ValueError("DATABASE_ECHO must be disabled in production")
        return self


settings = Settings()
