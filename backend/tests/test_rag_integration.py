"""PostgreSQL integration coverage for the complete tenant-scoped RAG workflow."""

from collections.abc import AsyncIterator, Generator
from io import BytesIO
import os
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi import UploadFile
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import Session, sessionmaker

from app.ai.providers import ChatProvider, ChatResult, EmbeddingProvider
from app.database.models.company import Company
from app.database.models.conversations import Conversation, Message
from app.database.models.documents import Document
from app.database.models.embeddings import DocumentChunk, DocumentEmbedding
from app.database.models.enums import DocumentVisibility, UserRole
from app.database.models.user import User
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.embedding_repository import DocumentEmbeddingRepository
from app.services import document_ingestion_service as ingestion_module
from app.services.chat_orchestrator_service import ChatOrchestratorService
from app.services.context_builder import ContextBuilder
from app.services.conversation_service import ConversationService
from app.services.document_service import DocumentService
from app.services.embedding_service import EmbeddingService
from app.services.rag_retrieval_service import RAGRetrievalService
from app.services.vector_search_service import VectorSearchService

pytestmark = pytest.mark.integration


class _Storage:
    """Minimal object-store substitute; extraction still runs through DocumentService."""

    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def bucket_exists(self, _bucket: str) -> bool:
        return True

    def put_object(self, _bucket: str, key: str, stream: BytesIO, length: int, **_kwargs: object) -> None:
        self.objects[key] = stream.read(length)


class _DeterministicEmbeddingProvider(EmbeddingProvider):
    """Stable semantic vectors for ingestion and query embedding."""

    config = SimpleNamespace(embedding_model="integration-embedding")

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [[1.0, 0.0] if "warranty" in value.lower() else [0.0, 1.0] for value in texts]

    async def health_check(self) -> None:
        return None


class _RecordingChatProvider(ChatProvider):
    """Records the final prompt to prove the orchestrator consumed retrieved context."""

    def __init__(self) -> None:
        self.messages: list[dict[str, str]] = []

    async def complete(self, messages: list[dict[str, str]]) -> ChatResult:
        self.messages = messages
        return ChatResult("The warranty lasts five years.", 23, 7)

    async def stream(self, _messages: list[dict[str, str]]) -> AsyncIterator[str]:
        if False:
            yield ""

    async def health_check(self) -> None:
        return None


@pytest.fixture
def pg_session() -> Generator[Session, None, None]:
    """Connect to the migrated pgvector database and remove only test-owned tenants."""
    database_url = os.getenv("TEST_POSTGRES_URL")
    if not database_url:
        pytest.skip("TEST_POSTGRES_URL is required for pgvector integration tests")
    engine = create_engine(database_url)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    session = factory()
    company_ids: list[UUID] = []
    session.info["integration_company_ids"] = company_ids
    try:
        assert session.scalar(text("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')"))
        yield session
    finally:
        session.rollback()
        for company_id in company_ids:
            parameters = {"company_id": company_id}
            # Users are intentionally RESTRICTed by audit/document ownership, so remove
            # the test tenant's dependent aggregate roots before its identities.
            for table in ("activities", "conversations", "documents", "users", "companies"):
                session.execute(text(f"DELETE FROM {table} WHERE {'id' if table == 'companies' else 'company_id'} = :company_id"), parameters)
        session.commit()
        session.close()
        engine.dispose()


def _tenant(session: Session, name: str) -> tuple[Company, User]:
    company = Company(id=uuid4(), name=name, slug=f"{name.lower()}-{uuid4().hex}")
    actor = User(
        id=uuid4(), company_id=company.id, role=UserRole.ADMIN, first_name="Rag", last_name="Tester",
        email=f"{uuid4().hex}@example.com", password_hash="integration-test-hash",
    )
    session.add_all([company, actor])
    session.commit()
    session.info["integration_company_ids"].append(company.id)
    return company, actor


async def _upload_and_process(session: Session, actor: User, title: str, content: str, monkeypatch) -> Document:
    document = await DocumentService(session, _Storage()).upload(
        actor,
        UploadFile(file=BytesIO(content.encode()), filename=f"{title.lower()}.txt", headers={"content-type": "text/plain"}),
        title, None, None, None, DocumentVisibility.COMPANY, [],
    )
    factory = sessionmaker(bind=session.get_bind(), expire_on_commit=False)
    embeddings = EmbeddingService(_DeterministicEmbeddingProvider())
    monkeypatch.setattr(ingestion_module, "SessionLocal", factory)
    monkeypatch.setattr(ingestion_module, "EmbeddingService", lambda: embeddings)
    await ingestion_module.process_document_in_background(document.id, actor.company_id)
    session.expire_all()
    return session.get(Document, document.id)


@pytest.mark.asyncio
async def test_complete_rag_workflow_uses_pgvector_context_and_persists_chat(pg_session: Session, monkeypatch) -> None:
    """Upload through chat persistence is integrated through the real database and services."""
    company, actor = _tenant(pg_session, "RagFlow")
    document = await _upload_and_process(
        pg_session, actor, "Warranty Policy",
        "The premium equipment warranty lasts five years and includes replacement parts.", monkeypatch,
    )

    assert document is not None
    assert document.extracted_text and "five years" in document.extracted_text
    assert document.processing_status == "ready"
    chunks = list(pg_session.scalars(select(DocumentChunk).where(DocumentChunk.document_id == document.id)))
    embeddings = list(pg_session.scalars(select(DocumentEmbedding).join(DocumentChunk).where(DocumentChunk.document_id == document.id)))
    assert chunks and all(chunk.extracted_text for chunk in chunks)
    assert len(embeddings) == len(chunks)

    embedding_service = EmbeddingService(_DeterministicEmbeddingProvider())
    search = VectorSearchService(DocumentEmbeddingRepository(pg_session))
    retrieval_service = RAGRetrievalService(embedding_service, search)
    retrieval = await retrieval_service.retrieve(actor, "What is the warranty period?")
    assert retrieval.chunks and retrieval.chunks[0].document_id == document.id
    context = ContextBuilder().build(retrieval)
    assert "five years" in context

    chat_provider = _RecordingChatProvider()
    orchestrator = ChatOrchestratorService(retrieval_service, ContextBuilder(), chat_provider)
    conversations = ConversationService(ConversationRepository(pg_session))
    conversation = conversations.create_conversation(actor)
    conversations.add_user_message(actor, conversation.id, "What is the warranty period?")
    result = await orchestrator.respond(actor, company, conversation.id, "What is the warranty period?")
    conversations.add_assistant_message(actor, conversation.id, result.response, {"source_documents": result.source_documents})

    assert any("five years" in message["content"] for message in chat_provider.messages)
    assert result.source_document_ids == [document.id]
    assert [citation.document_id for citation in result.citations] == [document.id]
    assert result.citations[0].title == "Warranty Policy"
    stored = pg_session.scalar(select(Conversation).where(Conversation.id == conversation.id))
    messages = list(pg_session.scalars(select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at)))
    assert stored is not None and stored.company_id == company.id and stored.owner_id == actor.id
    assert [(message.role, message.content) for message in messages] == [
        ("user", "What is the warranty period?"),
        ("assistant", "The warranty lasts five years."),
    ]


@pytest.mark.asyncio
async def test_vector_search_and_conversation_context_are_tenant_isolated(pg_session: Session, monkeypatch) -> None:
    """Neither direct vector retrieval nor orchestration can cross company boundaries."""
    company_a, actor_a = _tenant(pg_session, "TenantA")
    company_b, actor_b = _tenant(pg_session, "TenantB")
    secret = await _upload_and_process(pg_session, actor_a, "Secret Warranty", "Secret warranty code warranty-alpha.", monkeypatch)
    await _upload_and_process(pg_session, actor_b, "Payroll Guide", "Payroll submissions close every Friday.", monkeypatch)

    embeddings = EmbeddingService(_DeterministicEmbeddingProvider())
    tenant_b_retrieval = RAGRetrievalService(embeddings, VectorSearchService(DocumentEmbeddingRepository(pg_session)))
    direct_results = VectorSearchService(DocumentEmbeddingRepository(pg_session)).search(actor_b, [1.0, 0.0])
    assert all(item.document_id != secret.id for item in direct_results)
    assert all(pg_session.get(Document, item.document_id).company_id == company_b.id for item in direct_results)

    chat_provider = _RecordingChatProvider()
    orchestrator = ChatOrchestratorService(tenant_b_retrieval, ContextBuilder(), chat_provider)
    conversations = ConversationService(ConversationRepository(pg_session))
    conversation = conversations.create_conversation(actor_b)
    conversations.add_user_message(actor_b, conversation.id, "Tell me the warranty code")
    result = await orchestrator.respond(actor_b, company_b, conversation.id, "Tell me the warranty code")
    conversations.add_assistant_message(actor_b, conversation.id, result.response)

    prompt = "\n".join(message["content"] for message in chat_provider.messages)
    assert "warranty-alpha" not in prompt
    assert secret.id not in result.source_document_ids
    assert all(citation.document_id != secret.id for citation in result.citations)
    assert pg_session.scalar(select(func.count()).select_from(Message).join(Conversation).where(Conversation.company_id == company_a.id)) == 0
    assert pg_session.scalar(select(func.count()).select_from(Message).join(Conversation).where(Conversation.company_id == company_b.id)) == 2
