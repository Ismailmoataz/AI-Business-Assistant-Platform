"""Unit tests for asynchronous, tenant-scoped document ingestion."""

from io import BytesIO
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.api.routes import documents as document_routes
from app.database.models.company import Company
from app.database.models.documents import Document, DocumentVersion
from app.database.models.embeddings import DocumentChunk, DocumentEmbedding
from app.database.models.enums import DocumentStatus, DocumentVisibility, UserRole
from app.database.models.user import User
from app.repositories.embedding_repository import DocumentEmbeddingRepository
from app.services import document_ingestion_service as ingestion_module
from app.services.document_ingestion_service import DocumentIngestionService
from app.services.embedding_service import GeneratedEmbedding


class _EmbeddingService:
    """Deterministic embedding substitute that records the processing state it observes."""

    def __init__(self, document: Document, status_session_factory=None) -> None:
        self._document = document
        self._status_session_factory = status_session_factory
        self._provider = SimpleNamespace(config=SimpleNamespace(embedding_model="test-embedding"))
        self.calls = 0
        self.seen_statuses: list[str] = []

    async def generate(self, texts: list[str]) -> list[GeneratedEmbedding]:
        """Return one stable vector for every supplied chunk."""
        self.calls += 1
        if self._status_session_factory is None:
            self.seen_statuses.append(self._document.processing_status)
        else:
            with self._status_session_factory() as status_session:
                self.seen_statuses.append(status_session.get(Document, self._document.id).processing_status)
        return [GeneratedEmbedding(index, text, [1.0, 0.0]) for index, text in enumerate(texts)]


class _FailingEmbeddingService(_EmbeddingService):
    """Embedding substitute that simulates a provider outage."""

    async def generate(self, texts: list[str]) -> list[GeneratedEmbedding]:
        """Fail after the document has entered processing."""
        self.calls += 1
        self.seen_statuses.append(self._document.processing_status)
        raise RuntimeError("embedding provider unavailable")


def _stored_document(session: Session) -> tuple[User, Document]:
    """Create one uploaded document and immutable version in an isolated tenant."""
    company = Company(id=uuid4(), name="Acme", slug=f"acme-{uuid4().hex}")
    actor = User(id=uuid4(), company_id=company.id, role=UserRole.ADMIN, first_name="Ada", last_name="Admin", email=f"{uuid4().hex}@example.com", password_hash="hash")
    document = Document(
        id=uuid4(), company_id=company.id, owner_id=actor.id, title="Handbook", filename="handbook.txt",
        mime_type="text/plain", size_bytes=19, visibility=DocumentVisibility.PRIVATE,
        status=DocumentStatus.ACTIVE, object_key=f"{company.id}/handbook.txt",
        extracted_text="First paragraph.\n\nSecond paragraph.", processing_status="uploaded",
    )
    version = DocumentVersion(
        id=uuid4(), document_id=document.id, uploaded_by_user_id=actor.id, version=1,
        filename=document.filename, mime_type=document.mime_type, size_bytes=document.size_bytes,
        object_key=document.object_key, extracted_text=document.extracted_text,
    )
    session.add_all([company, actor, document, version])
    session.commit()
    session.refresh(document)
    return actor, document


@pytest.mark.asyncio
async def test_upload_returns_uploaded_document_and_schedules_background_work(session: Session, monkeypatch) -> None:
    """The upload handler must enqueue ingestion without executing it inline."""
    actor, document = _stored_document(session)

    class _UploadService:
        async def upload(self, *_args: object) -> Document:
            return document

    class _Tasks:
        def __init__(self) -> None:
            self.scheduled: list[tuple[object, tuple[object, ...]]] = []

        def add_task(self, function: object, *args: object) -> None:
            self.scheduled.append((function, args))

    tasks = _Tasks()
    monkeypatch.setattr(document_routes, "svc", lambda _session: _UploadService())
    response = await document_routes.upload_document(
        tasks, UploadFile(file=BytesIO(b"document"), filename="handbook.txt"), "Handbook",
        None, None, None, DocumentVisibility.PRIVATE, [], actor, session,
    )

    assert response.processing_status == "uploaded"
    assert tasks.scheduled == [(ingestion_module.process_document_in_background, (document.id, document.company_id))]


@pytest.mark.asyncio
async def test_background_processing_succeeds_with_correct_status_transitions(session: Session, monkeypatch) -> None:
    """A background run must transition uploaded to processing to ready and persist vectors."""
    _, document = _stored_document(session)
    session_factory = sessionmaker(bind=session.get_bind(), expire_on_commit=False)
    embeddings = _EmbeddingService(document, session_factory)
    monkeypatch.setattr(ingestion_module, "SessionLocal", session_factory)
    monkeypatch.setattr(ingestion_module, "EmbeddingService", lambda: embeddings)

    await ingestion_module.process_document_in_background(document.id, document.company_id)
    session.expire_all()
    stored = session.get(Document, document.id)

    assert stored is not None
    assert stored.processing_status == "ready"
    assert stored.processing_error is None
    assert embeddings.seen_statuses == ["processing"]
    assert session.scalar(select(func.count()).select_from(DocumentChunk).where(DocumentChunk.document_id == document.id)) == 1
    assert session.scalar(select(func.count()).select_from(DocumentEmbedding).join(DocumentChunk).where(DocumentChunk.document_id == document.id)) == 1


@pytest.mark.asyncio
async def test_processing_failure_preserves_document_and_records_error(session: Session) -> None:
    """Provider failure must leave the upload intact and atomically persist failed diagnostics."""
    _, document = _stored_document(session)
    embeddings = _FailingEmbeddingService(document)

    await DocumentIngestionService(DocumentEmbeddingRepository(session), embeddings=embeddings).ingest(document)
    session.refresh(document)

    assert document.processing_status == "failed"
    assert document.processing_error == "RuntimeError: embedding provider unavailable"
    assert session.get(Document, document.id) is document
    assert len(document.versions) == 1
    assert session.scalar(select(func.count()).select_from(DocumentChunk).where(DocumentChunk.document_id == document.id)) == 0
    assert embeddings.seen_statuses == ["processing"]


@pytest.mark.asyncio
async def test_failed_processing_can_retry_and_ready_retrigger_is_idempotent(session: Session) -> None:
    """A failed upload can retry once, while triggering a ready document cannot duplicate rows."""
    _, document = _stored_document(session)
    await DocumentIngestionService(DocumentEmbeddingRepository(session), embeddings=_FailingEmbeddingService(document)).ingest(document)
    successful_embeddings = _EmbeddingService(document)
    service = DocumentIngestionService(DocumentEmbeddingRepository(session), embeddings=successful_embeddings)

    await service.ingest(document)
    await service.ingest(document)
    session.refresh(document)

    assert document.processing_status == "ready"
    assert document.processing_error is None
    assert successful_embeddings.calls == 1
    assert session.scalar(select(func.count()).select_from(DocumentChunk).where(DocumentChunk.document_id == document.id)) == 1
    assert session.scalar(select(func.count()).select_from(DocumentEmbedding).join(DocumentChunk).where(DocumentChunk.document_id == document.id)) == 1
