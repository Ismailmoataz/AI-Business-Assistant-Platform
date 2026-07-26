"""Tenant-safe persistence operations for document chunks and embeddings."""

from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.database.models.embeddings import DocumentChunk, DocumentEmbedding


class DocumentChunkRepository:
    """Encapsulates company-scoped document chunk persistence queries."""

    def __init__(self, session: Session) -> None:
        """Bind the repository to a request unit-of-work session."""
        self._session = session

    def add(self, chunk: DocumentChunk) -> None:
        """Stage a document chunk for persistence."""
        self._session.add(chunk)

    def get_for_company(self, chunk_id: UUID, company_id: UUID) -> DocumentChunk | None:
        """Return one chunk only when it belongs to the requested tenant."""
        return self._session.scalar(select(DocumentChunk).where(DocumentChunk.id == chunk_id, DocumentChunk.company_id == company_id))

    def list_for_document(self, document_id: UUID, company_id: UUID) -> list[DocumentChunk]:
        """Return ordered chunks for one tenant-owned document."""
        return list(self._session.scalars(select(DocumentChunk).where(DocumentChunk.document_id == document_id, DocumentChunk.company_id == company_id).order_by(DocumentChunk.chunk_index)))

    def list_for_version(self, version_id: UUID, company_id: UUID) -> list[DocumentChunk]:
        """Return ordered chunks for one tenant-owned document version."""
        return list(self._session.scalars(select(DocumentChunk).where(DocumentChunk.version_id == version_id, DocumentChunk.company_id == company_id).order_by(DocumentChunk.chunk_index)))

    def add_all(self, chunks: list[DocumentChunk]) -> None:
        """Stage ordered chunks for one atomic caller-managed transaction."""
        self._session.add_all(chunks)


class DocumentEmbeddingRepository:
    """Encapsulates embedding persistence and non-similarity lookup operations."""

    def __init__(self, session: Session) -> None:
        """Bind the repository to a request unit-of-work session."""
        self._session = session

    def add(self, embedding: DocumentEmbedding) -> None:
        """Stage an embedding for persistence."""
        self._session.add(embedding)

    def add_all(self, embeddings: list[DocumentEmbedding]) -> None:
        """Stage embeddings for one atomic caller-managed transaction."""
        self._session.add_all(embeddings)

    def persist_document_batch(self, chunks: list[DocumentChunk], embeddings: list[DocumentEmbedding]) -> None:
        """Persist chunks and embeddings atomically while preserving supplied chunk order."""
        try:
            self._stage_batch(chunks, embeddings)
            self._session.commit()
        except Exception:
            self._session.rollback()
            raise

    def replace_version_batch(self, version_id: UUID, company_id: UUID, chunks: list[DocumentChunk], embeddings: list[DocumentEmbedding]) -> None:
        """Stage an idempotent replacement batch for one document version."""
        existing = list(self._session.scalars(select(DocumentChunk).where(DocumentChunk.version_id == version_id, DocumentChunk.company_id == company_id)))
        for chunk in existing:
            self._session.delete(chunk)
        self._session.flush()
        self._stage_batch(chunks, embeddings)

    def _stage_batch(self, chunks: list[DocumentChunk], embeddings: list[DocumentEmbedding]) -> None:
        """Stage and flush chunks before their dependent embeddings."""
        self._session.add_all(chunks)
        self._session.flush()
        self._session.add_all(embeddings)

    def similarity_search(self, vector: list[float], company_id: UUID, limit: int, user_id: UUID, department_id: UUID | None, is_admin: bool) -> list[dict]:
        """Return tenant- and visibility-filtered cosine-ranked document chunks."""
        vector_literal = "[" + ",".join(str(float(value)) for value in vector) + "]"
        sql = text("""
            SELECT c.id AS chunk_id, c.document_id, c.chunk_index, c.extracted_text,
                   d.title, d.filename, 1 - ((e.embedding::vector) <=> CAST(:vector AS vector)) AS similarity_score
            FROM document_embeddings e
            JOIN document_chunks c ON c.id = e.chunk_id
            JOIN documents d ON d.id = c.document_id
            WHERE c.company_id = :company_id
              AND d.company_id = :company_id
              AND d.deleted_at IS NULL
              AND (
                  :is_admin
                  OR d.visibility = 'company'
                  OR d.owner_id = :user_id
                  OR (d.visibility = 'department' AND d.department_id = :department_id)
              )
            ORDER BY e.embedding::vector <=> CAST(:vector AS vector)
            LIMIT :limit
        """)
        return [
            dict(row)
            for row in self._session.execute(
                sql,
                {
                    "vector": vector_literal,
                    "company_id": company_id,
                    "user_id": user_id,
                    "department_id": department_id,
                    "is_admin": is_admin,
                    "limit": limit,
                },
            ).mappings()
        ]

    def get_for_chunk(self, chunk_id: UUID, provider: str, model: str) -> DocumentEmbedding | None:
        """Return a provider/model-specific embedding for one chunk."""
        return self._session.scalar(select(DocumentEmbedding).where(DocumentEmbedding.chunk_id == chunk_id, DocumentEmbedding.provider == provider, DocumentEmbedding.model == model))

    def list_for_document(self, document_id: UUID, company_id: UUID, provider: str | None = None, model: str | None = None) -> list[DocumentEmbedding]:
        """Return embeddings only through tenant-scoped document chunks."""
        statement = select(DocumentEmbedding).join(DocumentChunk).where(DocumentChunk.document_id == document_id, DocumentChunk.company_id == company_id)
        if provider is not None:
            statement = statement.where(DocumentEmbedding.provider == provider)
        if model is not None:
            statement = statement.where(DocumentEmbedding.model == model)
        return list(self._session.scalars(statement))

    def list_for_chunks(self, chunk_ids: list[UUID], provider: str, model: str) -> list[DocumentEmbedding]:
        """Return embeddings for an explicit chunk collection and configured model."""
        if not chunk_ids:
            return []
        return list(self._session.scalars(select(DocumentEmbedding).where(DocumentEmbedding.chunk_id.in_(chunk_ids), DocumentEmbedding.provider == provider, DocumentEmbedding.model == model)))
