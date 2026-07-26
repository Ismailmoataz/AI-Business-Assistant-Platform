"""Request and response contracts for tenant knowledge documents."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.database.models.enums import DocumentStatus, DocumentVisibility
from app.schemas.business import PageMeta, TagResponse


class FolderCreateRequest(BaseModel):
    """Payload for creating a nested knowledge folder."""

    name: str = Field(min_length=1, max_length=180)
    parent_id: UUID | None = None
    department_id: UUID | None = None
    visibility: DocumentVisibility = DocumentVisibility.PRIVATE

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        """Normalize a non-empty folder name."""
        value = value.strip()
        if not value:
            raise ValueError("Name must not be blank")
        return value


class FolderUpdateRequest(BaseModel):
    """Payload for renaming, moving, or changing folder access."""

    name: str | None = Field(default=None, min_length=1, max_length=180)
    parent_id: UUID | None = None
    department_id: UUID | None = None
    visibility: DocumentVisibility | None = None


class FolderResponse(BaseModel):
    """Folder metadata visible to an authorized tenant member."""

    model_config = ConfigDict(from_attributes=True)
    id: UUID
    company_id: UUID
    parent_id: UUID | None
    owner_id: UUID
    department_id: UUID | None
    name: str
    visibility: DocumentVisibility
    created_at: datetime
    updated_at: datetime


class DocumentUpdateRequest(BaseModel):
    """Payload for document metadata, organization, and permission updates."""

    title: str | None = Field(default=None, min_length=1, max_length=250)
    description: str | None = Field(default=None, max_length=20000)
    folder_id: UUID | None = None
    customer_id: UUID | None = None
    department_id: UUID | None = None
    visibility: DocumentVisibility | None = None
    status: DocumentStatus | None = None
    tag_ids: list[UUID] | None = Field(default=None, max_length=50)


class DocumentResponse(BaseModel):
    """Document metadata excluding object storage implementation details."""

    model_config = ConfigDict(from_attributes=True)
    id: UUID
    company_id: UUID
    folder_id: UUID | None
    customer_id: UUID | None
    owner_id: UUID
    department_id: UUID | None
    title: str
    filename: str
    mime_type: str
    size_bytes: int
    description: str | None
    visibility: DocumentVisibility
    status: DocumentStatus
    version: int
    processing_status: str
    tags: list[TagResponse]
    created_at: datetime
    updated_at: datetime


class DocumentVersionResponse(BaseModel):
    """Immutable metadata for a document revision."""

    model_config = ConfigDict(from_attributes=True)
    id: UUID
    document_id: UUID
    uploaded_by_user_id: UUID
    version: int
    filename: str
    mime_type: str
    size_bytes: int
    created_at: datetime


class DocumentPage(BaseModel):
    """Paginated document search or list result."""

    items: list[DocumentResponse]
    page: PageMeta


class FolderPage(BaseModel):
    """Paginated folder listing."""

    items: list[FolderResponse]
    page: PageMeta


class SignedUrlResponse(BaseModel):
    """Short-lived, authorized signed URL for a selected document version."""

    url: str
    expires_in_seconds: int


class SearchResultResponse(DocumentResponse):
    """Document search result with an optional safe query highlight."""

    highlight: str | None = None
