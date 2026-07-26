"""Tenant-safe semantic retrieval and prompt-ready document context assembly."""

from dataclasses import dataclass

from app.config.settings import Settings, settings
from app.database.models.user import User
from app.services.embedding_service import EmbeddingService
from app.services.vector_search_service import VectorSearchResult, VectorSearchService


@dataclass(frozen=True)
class RetrievalContext:
    """Retrieved visible chunks and their bounded prompt-ready text."""

    chunks: list[VectorSearchResult]
    text: str


class RAGRetrievalService:
    """Embeds one query and retrieves visible document chunks without LLM generation."""

    def __init__(self, embeddings: EmbeddingService, search: VectorSearchService, config: Settings = settings) -> None:
        """Create retrieval from existing provider-agnostic embedding and vector services."""
        self._embeddings, self._search = embeddings, search
        self._top_k, self._threshold, self._max_context = config.top_k, config.minimum_similarity_score, config.max_context_size

    async def retrieve(self, actor: User, query: str, top_k: int | None = None) -> RetrievalContext:
        """Return threshold-filtered tenant-visible chunks for a non-empty user query."""
        generated = await self._embeddings.generate([query])
        if not generated:
            return RetrievalContext([], "")
        chunks = [item for item in self._search.search(actor, generated[0].vector, top_k or self._top_k) if item.similarity_score >= self._threshold]
        return RetrievalContext(chunks, self._assemble(chunks))

    def _assemble(self, chunks: list[VectorSearchResult]) -> str:
        """Preserve source names and chunk ordering within a configured context bound."""
        parts: list[str] = []
        used = 0
        for chunk in sorted(chunks, key=lambda item: (-item.similarity_score, item.title, item.chunk_index)):
            part = f"[Document: {chunk.title} | File: {chunk.filename} | Chunk: {chunk.chunk_index}]\n{chunk.text}"
            if used + len(part) > self._max_context:
                part = part[: max(0, self._max_context - used)]
            if part:
                parts.append(part)
                used += len(part)
            if used >= self._max_context:
                break
        return "\n\n".join(parts)
