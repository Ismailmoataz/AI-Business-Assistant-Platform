"""Company and department API contracts."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DepartmentCreateRequest(BaseModel):
    """Payload used to create a department in the current company."""

    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=5000)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        """Reject whitespace-only names and normalize surrounding whitespace."""
        normalized = value.strip()
        if not normalized:
            raise ValueError("Name must not be blank")
        return normalized


class DepartmentResponse(BaseModel):
    """Public department representation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class UserDepartmentUpdateRequest(BaseModel):
    """Payload used to assign or clear a user's department."""

    department_id: UUID | None
