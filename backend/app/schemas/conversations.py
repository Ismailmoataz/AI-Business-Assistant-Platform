"""HTTP contracts for authenticated conversation persistence."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.business import PageMeta
from app.schemas.chat import CitationResponse


class ConversationCreateRequest(BaseModel):
    """Payload used to create a user-owned conversation."""

    title: str | None = Field(default=None, max_length=250)


class ConversationUpdateRequest(BaseModel):
    """Payload used to rename an owned conversation."""

    title: str = Field(min_length=1, max_length=250)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        """Trim the title and reject whitespace-only names."""
        normalized = value.strip()
        if not normalized:
            raise ValueError("Title must not be blank")
        return normalized


class MessageResponse(BaseModel):
    """Public chronological conversation message representation."""

    model_config = ConfigDict(from_attributes=True)
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    citations: list[CitationResponse] = Field(default_factory=list)
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def citations_from_metadata(cls, obj: object) -> object:
        """Expose persisted citation metadata while keeping storage details private."""
        if isinstance(obj, dict):
            metadata = obj.get("metadata_", {})
            if "citations" not in obj and isinstance(metadata, dict):
                return {**obj, "citations": metadata.get("citations", [])}
            return obj
        metadata = getattr(obj, "metadata_", {})
        return {
            "id": getattr(obj, "id"),
            "conversation_id": getattr(obj, "conversation_id"),
            "role": getattr(obj, "role"),
            "content": getattr(obj, "content"),
            "citations": metadata.get("citations", []) if isinstance(metadata, dict) else [],
            "created_at": getattr(obj, "created_at"),
        }


class ConversationResponse(BaseModel):
    """Public conversation metadata representation."""

    model_config = ConfigDict(from_attributes=True)
    id: UUID
    company_id: UUID
    owner_id: UUID
    title: str | None
    last_message_preview: str | None = None
    created_at: datetime
    updated_at: datetime


class ConversationDetailResponse(ConversationResponse):
    """Conversation metadata together with chronological messages."""

    messages: list[MessageResponse]


class ConversationPage(BaseModel):
    """Paginated list of the authenticated user's conversations."""

    items: list[ConversationResponse]
    page: PageMeta


class ConversationMessageCreateRequest(BaseModel):
    """Payload used to submit one user message to an owned conversation."""

    content: str = Field(min_length=1, max_length=20000)


class ConversationMessageResponse(BaseModel):
    """Assistant reply and the resulting conversation metadata."""

    conversation: ConversationResponse
    message: MessageResponse
    source_documents: list[str]
    citations: list[CitationResponse] = Field(default_factory=list)
    input_tokens: int | None
    output_tokens: int | None
