"""Operational endpoint response contracts."""

from typing import Literal

from pydantic import BaseModel


class ServiceStatusResponse(BaseModel):
    """Public service-status response."""

    message: str


class LivenessResponse(BaseModel):
    """Successful process-liveness response."""

    status: Literal["ok"]


class HealthResponse(BaseModel):
    """Successful dependency-readiness response."""

    status: Literal["ok"]
    dependencies: dict[str, Literal["ok"]]
