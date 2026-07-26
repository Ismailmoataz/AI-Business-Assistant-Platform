from collections.abc import AsyncIterator
from dataclasses import dataclass
from uuid import UUID

from app.ai.providers import ChatProvider
from app.database.models.company import Company
from app.database.models.user import User
from app.services.context_builder import ContextBuilder
from app.services.rag_retrieval_service import RAGRetrievalService, RetrievalContext
from app.services.prompt_builder_service import PromptBuilderService


@dataclass(frozen=True)
class SourceCitation:
    """Real document metadata associated with one highest-ranked retrieved chunk."""

    document_id: UUID
    title: str
    filename: str
    chunk_index: int
    similarity_score: float

    def as_metadata(self) -> dict[str, str | int | float]:
        """Return a JSON-safe representation suitable for message metadata."""
        return {
            "document_id": str(self.document_id),
            "title": self.title,
            "filename": self.filename,
            "chunk_index": self.chunk_index,
            "similarity_score": self.similarity_score,
        }


@dataclass(frozen=True)
class OrchestratedChatResponse:
    """A chat completion with retrieval source names and normalized usage metadata."""

    response: str
    source_documents: list[str]
    source_document_ids: list[UUID]
    chunk_similarity_scores: list[float]
    citations: list[SourceCitation]
    input_tokens: int | None
    output_tokens: int | None

    def message_metadata(self) -> dict[str, object]:
        """Return the persisted metadata shared by synchronous and streaming chat."""
        return {
            "source_documents": self.source_documents,
            "citations": [citation.as_metadata() for citation in self.citations],
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
        }


@dataclass(frozen=True)
class PreparedChatStream:
    """Provider token stream together with its already-authorized retrieval citations."""

    tokens: AsyncIterator[str]
    citations: list[SourceCitation]

    def message_metadata(self) -> dict[str, object]:
        """Return JSON-safe metadata persisted only after the stream completes."""
        return {
            "source_documents": list(dict.fromkeys(citation.title for citation in self.citations)),
            "citations": [citation.as_metadata() for citation in self.citations],
        }


class ChatOrchestratorService:
    """Builds a tenant-aware prompt from existing retrieval and context services."""

    def __init__(self, retrieval: RAGRetrievalService, context_builder: ContextBuilder, chat_provider: ChatProvider, prompt_builder: PromptBuilderService | None = None) -> None:
        """Create a stateless orchestration service from independent components."""
        self._retrieval = retrieval
        self._context_builder = context_builder
        self._chat_provider = chat_provider
        self._prompt_builder = prompt_builder or PromptBuilderService()

    @staticmethod
    def _citations(retrieval: RetrievalContext) -> list[SourceCitation]:
        """Keep the highest-ranked real chunk for each retrieved document."""
        citations: list[SourceCitation] = []
        seen: set[UUID] = set()
        for chunk in retrieval.chunks:
            if chunk.document_id in seen:
                continue
            seen.add(chunk.document_id)
            citations.append(
                SourceCitation(
                    document_id=chunk.document_id,
                    title=chunk.title,
                    filename=chunk.filename,
                    chunk_index=chunk.chunk_index,
                    similarity_score=chunk.similarity_score,
                )
            )
        return citations

    async def respond(self, user: User, company: Company, conversation_id: UUID | None, user_message: str, history: list[dict[str, str]] | None = None) -> OrchestratedChatResponse:
        """Retrieve visible context and request one configured-provider completion without persistence."""
        retrieval = await self._retrieval.retrieve(user, user_message)
        context = self._context_builder.build(retrieval)
        messages = self._prompt_builder.build(company, user, context, history or [], user_message)
        result = await self._chat_provider.complete(messages)
        source_documents = list(dict.fromkeys(chunk.title for chunk in retrieval.chunks))
        source_document_ids = list(dict.fromkeys(chunk.document_id for chunk in retrieval.chunks))
        similarity_scores = [chunk.similarity_score for chunk in retrieval.chunks]
        return OrchestratedChatResponse(
            result.text,
            source_documents,
            source_document_ids,
            similarity_scores,
            self._citations(retrieval),
            result.input_tokens,
            result.output_tokens,
        )

    async def prepare_stream(self, user: User, company: Company, conversation_id: UUID | None, user_message: str, history: list[dict[str, str]] | None = None) -> PreparedChatStream:
        """Prepare one provider stream and retain the authorized retrieval citation set."""
        retrieval = await self._retrieval.retrieve(user, user_message)
        messages = self._prompt_builder.build(company, user, self._context_builder.build(retrieval), history or [], user_message)
        return PreparedChatStream(self._chat_provider.stream(messages), self._citations(retrieval))

    async def stream(self, user: User, company: Company, conversation_id: UUID | None, user_message: str, history: list[dict[str, str]] | None = None) -> AsyncIterator[str]:
        """Stream configured-provider tokens after applying the same retrieval and prompt pipeline."""
        prepared = await self.prepare_stream(user, company, conversation_id, user_message, history)
        async for token in prepared.tokens:
            yield token
