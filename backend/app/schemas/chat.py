"""HTTP contracts for synchronous chat message orchestration."""

from uuid import UUID

from pydantic import BaseModel, Field


class ChatMessageRequest(BaseModel):
    """Payload for a user message with an optional existing conversation."""

    conversation_id: UUID | None = None
    content: str = Field(min_length=1, max_length=20000)


class ChatRegenerateRequest(BaseModel):
    """Payload identifying one owned assistant response to regenerate."""

    conversation_id: UUID
    assistant_message_id: UUID


class CitationResponse(BaseModel):
    """Real retrieved-document metadata safe to expose as a source citation."""

    document_id: UUID
    title: str
    filename: str
    chunk_index: int = Field(ge=0)
    similarity_score: float


class ChatMessageResponse(BaseModel):
    """Synchronous assistant response bound to a conversation."""

    conversation_id: UUID
    response: str
    source_documents: list[str]
    citations: list[CitationResponse] = Field(default_factory=list)
    input_tokens: int | None
    output_tokens: int | None
