"""Tenant-safe semantic document chunk retrieval without answer generation."""

from dataclasses import dataclass
from uuid import UUID

from app.config.settings import Settings, settings
from app.database.models.user import User
from app.repositories.embedding_repository import DocumentEmbeddingRepository


@dataclass(frozen=True)
class VectorSearchResult:
    """A visible document chunk ranked by cosine similarity."""

    chunk_id: UUID
    document_id: UUID
    chunk_index: int
    text: str
    title: str
    filename: str
    similarity_score: float


class VectorSearchService:
    """Adapts repository similarity rows into typed tenant-safe retrieval results."""

    def __init__(self, repository: DocumentEmbeddingRepository, config: Settings = settings) -> None:
        """Create the service with a configured retrieval limit."""
        self._repository, self._top_k = repository, config.top_k

    def search(self, actor: User, vector: list[float], top_k: int | None = None) -> list[VectorSearchResult]:
        """Retrieve only chunks visible to the authenticated tenant member."""
        rows = self._repository.similarity_search(vector, actor.company_id, top_k or self._top_k, actor.id, actor.department_id, actor.role.value == "admin")
        return [VectorSearchResult(chunk_id=row["chunk_id"], document_id=row["document_id"], chunk_index=row["chunk_index"], text=row["extracted_text"], title=row["title"], filename=row["filename"], similarity_score=float(row["similarity_score"])) for row in rows]
