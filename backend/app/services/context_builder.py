"""Prompt-ready, bounded formatting of retrieved document chunks."""

from collections.abc import Sequence

from app.config.settings import Settings, settings
from app.services.rag_retrieval_service import RetrievalContext
from app.services.vector_search_service import VectorSearchResult


class ContextBuilder:
    """Formats retrieved chunks in stable document and chunk order without model calls."""

    def __init__(self, config: Settings = settings) -> None:
        """Create the builder with the configured maximum context size."""
        self._maximum_size = config.max_context_size

    def build(self, retrieved: RetrievalContext | Sequence[VectorSearchResult]) -> str:
        """Build a clean, bounded source context while preserving supplied chunk order."""
        chunks = retrieved.chunks if isinstance(retrieved, RetrievalContext) else list(retrieved)
        sections: list[str] = []
        current_document: tuple[str, str] | None = None
        used = 0
        for chunk in chunks:
            document = (chunk.title, chunk.filename)
            header = "" if document == current_document else f"\n\n--- Document: {chunk.title} ({chunk.filename}) ---\n"
            body = f"[Chunk {chunk.chunk_index}]\n{chunk.text}\n"
            remaining = self._maximum_size - used
            if remaining <= 0:
                break
            content = (header + body)[:remaining]
            if content:
                sections.append(content)
                used += len(content)
            current_document = document
            if used >= self._maximum_size:
                break
        return "".join(sections).strip()
