"""Orchestrates chunking, embedding generation, and persistence for documents."""

import json
import logging
from uuid import UUID, uuid4

from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.database.connection import SessionLocal
from app.database.models.documents import Document
from app.database.models.embeddings import DocumentChunk, DocumentEmbedding
from app.repositories.embedding_repository import DocumentEmbeddingRepository
from app.services.chunking_service import ChunkingService
from app.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)


class DocumentIngestionService:
    """Creates persisted chunks and embeddings from an uploaded document's extracted text."""

    def __init__(self, repository: DocumentEmbeddingRepository, chunking: ChunkingService | None = None, embeddings: EmbeddingService | None = None) -> None:
        """Create the ingestion orchestrator from existing focused components."""
        self._repository = repository
        self._chunking = chunking
        self._embeddings = embeddings

    async def ingest(self, document: Document) -> None:
        """Persist ordered chunks and embeddings with idempotent lifecycle transitions."""
        session = self._repository._session
        claim = session.execute(
            update(Document)
            .where(
                Document.id == document.id,
                Document.company_id == document.company_id,
                Document.processing_status.in_(("uploaded", "failed")),
            )
            .values(processing_status="processing", processing_error=None)
        )
        session.commit()
        if claim.rowcount != 1:
            return
        session.refresh(document)
        try:
            if not document.versions:
                raise ValueError("Document has no version to process")
            chunking = self._chunking or ChunkingService()
            prepared = chunking.prepare(document.extracted_text)
            chunks = [DocumentChunk(id=uuid4(), company_id=document.company_id, document_id=document.id, version_id=document.versions[-1].id, chunk_index=item.chunk_index, extracted_text=item.text, token_count=item.token_count, metadata_=item.metadata) for item in prepared]
            embeddings: list[DocumentEmbedding] = []
            if prepared:
                embedding_service = self._embeddings or EmbeddingService()
                generated = await embedding_service.generate([item.text for item in prepared])
                if {item.input_index for item in generated} != set(range(len(chunks))):
                    raise ValueError("Embedding generation did not return every document chunk")
                provider = embedding_service._provider.__class__.__name__.removesuffix("EmbeddingProvider").lower()
                model = getattr(embedding_service._provider, "config").embedding_model
                embeddings = [DocumentEmbedding(chunk_id=chunks[item.input_index].id, embedding=json.dumps(item.vector), provider=provider, model=model) for item in generated]
            self._repository.replace_version_batch(document.versions[-1].id, document.company_id, chunks, embeddings)
            document.processing_status, document.processing_error = "ready", None
            session.commit()
        except Exception as exc:
            session.rollback()
            failed_document = session.scalar(select(Document).where(Document.id == document.id, Document.company_id == document.company_id))
            if failed_document is not None:
                failed_document.processing_status = "failed"
                failed_document.processing_error = f"{type(exc).__name__}: {exc}"[:5000]
                session.commit()
            logger.exception("Document ingestion failed for document %s in company %s", document.id, document.company_id)


async def process_document_in_background(document_id: UUID, company_id: UUID) -> None:
    """Load and ingest one document using an independent tenant-scoped session."""
    session = SessionLocal()
    try:
        document = session.scalar(
            select(Document)
            .options(selectinload(Document.versions))
            .where(Document.id == document_id, Document.company_id == company_id, Document.deleted_at.is_(None))
        )
        if document is not None:
            await DocumentIngestionService(DocumentEmbeddingRepository(session)).ingest(document)
    finally:
        session.close()
