"""Regression tests for SSE chat persistence and regeneration behavior."""

import json
from collections.abc import AsyncIterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.routes import chat as chat_routes
from app.database.connection import get_db
from app.database.models.conversations import Message
from app.database.models.user import User
from app.main import app
from app.repositories.conversation_repository import ConversationRepository
from app.schemas.chat import ChatMessageRequest, ChatRegenerateRequest
from app.services.chat_orchestrator_service import PreparedChatStream, SourceCitation
from app.services.conversation_service import ConversationService


class _StreamOrchestrator:
    """Deterministic streaming orchestrator substitute for endpoint tests."""

    def __init__(self, tokens: list[str] | None = None, error: Exception | None = None, citations: list[SourceCitation] | None = None) -> None:
        self._tokens = tokens or []
        self._error = error
        self._citations = citations or []

    async def prepare_stream(self, *_args: object, **_kwargs: object) -> PreparedChatStream:
        """Return configured citations with a provider-like token iterator."""
        async def tokens() -> AsyncIterator[str]:
            if self._error:
                raise self._error
            for token in self._tokens:
                yield token

        return PreparedChatStream(tokens(), self._citations)


def _headers(client: TestClient, slug: str = "acme", email: str = "admin@example.com") -> dict[str, str]:
    """Register an isolated user and return authentication headers."""
    response = client.post("/auth/register", json={"company_name": slug.title(), "company_slug": slug, "first_name": "Ada", "last_name": "Admin", "email": email, "password": "Correct-Horse-7-Battery!"})
    return {"Authorization": f"Bearer {response.json()['tokens']['access_token']}"}


def _citation() -> SourceCitation:
    """Return one real-shape citation for persistence assertions."""
    return SourceCitation(document_id=uuid4(), title="Launch plan", filename="launch.pdf", chunk_index=2, similarity_score=0.91)


def _complete_payload(response_text: str) -> dict:
    """Parse the final SSE complete-event payload from a buffered response."""
    complete_block = next(block for block in response_text.split("\n\n") if block.startswith("event: complete"))
    return json.loads(next(line[5:].strip() for line in complete_block.splitlines() if line.startswith("data:")))


def test_stream_persists_complete_assistant_message_and_citations(session: Session, monkeypatch) -> None:
    """A completed SSE response persists content and emits its real citation metadata."""
    app.dependency_overrides[get_db] = lambda: session
    client = TestClient(app)
    citation = _citation()
    monkeypatch.setattr(chat_routes, "_orchestrator", lambda _session: _StreamOrchestrator(["Hello", " world"], citations=[citation]))
    response = client.post("/chat/stream", json={"content": "Hi"}, headers=_headers(client))
    app.dependency_overrides.clear()

    assistant = session.query(Message).filter(Message.role == "assistant").one()
    completion = _complete_payload(response.text)
    assert response.status_code == 200
    assert assistant.content == "Hello world"
    assert assistant.metadata_["citations"] == [citation.as_metadata()]
    assert completion == {"message_id": str(assistant.id), "citations": [citation.as_metadata()]}


def test_stream_provider_failure_keeps_only_user_message(session: Session, monkeypatch) -> None:
    """Provider failure emits an SSE error and never stores a partial assistant message."""
    app.dependency_overrides[get_db] = lambda: session
    client = TestClient(app)
    monkeypatch.setattr(chat_routes, "_orchestrator", lambda _session: _StreamOrchestrator(error=RuntimeError("provider failed")))
    response = client.post("/chat/stream", json={"content": "Hi"}, headers=_headers(client))
    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert "event: error" in response.text
    assert session.query(Message).filter(Message.role == "user").count() == 1
    assert session.query(Message).filter(Message.role == "assistant").count() == 0


@pytest.mark.asyncio
async def test_stream_cancellation_before_completion_does_not_persist_assistant(session: Session, monkeypatch) -> None:
    """Closing the streaming response before completion leaves the committed user message only."""
    app.dependency_overrides[get_db] = lambda: session
    client = TestClient(app)
    monkeypatch.setattr(chat_routes, "_orchestrator", lambda _session: _StreamOrchestrator(["partial"]))
    _headers(client)
    actor = session.query(User).one()
    response = await chat_routes.stream(ChatMessageRequest(content="Hi"), actor, session)
    iterator = response.body_iterator
    assert "partial" in await anext(iterator)
    await iterator.aclose()
    app.dependency_overrides.clear()
    assert session.query(Message).filter(Message.role == "user").count() == 1
    assert session.query(Message).filter(Message.role == "assistant").count() == 0


def test_regeneration_replaces_assistant_in_place_and_preserves_prompt(session: Session, monkeypatch) -> None:
    """Successful regeneration updates only the selected assistant row after streaming."""
    app.dependency_overrides[get_db] = lambda: session
    client = TestClient(app)
    headers = _headers(client)
    actor = session.query(User).one()
    service = ConversationService(ConversationRepository(session))
    conversation = service.create_conversation(actor, "Planning")
    user_message = service.add_user_message(actor, conversation.id, "Preserve this prompt")
    old_citation = _citation()
    assistant = service.add_assistant_message(actor, conversation.id, "Old answer", {"citations": [old_citation.as_metadata()]})
    assistant_id = assistant.id
    assistant_created_at = assistant.created_at
    new_citation = _citation()
    monkeypatch.setattr(chat_routes, "_orchestrator", lambda _session: _StreamOrchestrator(["New", " answer"], citations=[new_citation]))

    response = client.post(
        "/chat/regenerate/stream",
        json={"conversation_id": str(conversation.id), "assistant_message_id": str(assistant_id)},
        headers=headers,
    )
    app.dependency_overrides.clear()

    messages = session.query(Message).filter(Message.conversation_id == conversation.id).order_by(Message.created_at, Message.id).all()
    replaced = session.get(Message, assistant_id)
    assert response.status_code == 200
    assert len(messages) == 2
    assert messages[0].id == user_message.id and messages[0].content == "Preserve this prompt"
    assert replaced is not None
    assert replaced.content == "New answer"
    assert replaced.created_at == assistant_created_at
    assert replaced.metadata_["citations"] == [new_citation.as_metadata()]
    assert _complete_payload(response.text)["message_id"] == str(assistant_id)


def test_failed_regeneration_preserves_previous_assistant_response(session: Session, monkeypatch) -> None:
    """A provider failure leaves the prior assistant response and metadata untouched."""
    app.dependency_overrides[get_db] = lambda: session
    client = TestClient(app)
    headers = _headers(client)
    actor = session.query(User).one()
    service = ConversationService(ConversationRepository(session))
    conversation = service.create_conversation(actor)
    service.add_user_message(actor, conversation.id, "Keep me")
    original = {"citations": [_citation().as_metadata()]}
    assistant = service.add_assistant_message(actor, conversation.id, "Keep the old answer", original)
    monkeypatch.setattr(chat_routes, "_orchestrator", lambda _session: _StreamOrchestrator(error=RuntimeError("provider failed")))

    response = client.post(
        "/chat/regenerate/stream",
        json={"conversation_id": str(conversation.id), "assistant_message_id": str(assistant.id)},
        headers=headers,
    )
    app.dependency_overrides.clear()

    session.refresh(assistant)
    assert "event: error" in response.text
    assert assistant.content == "Keep the old answer"
    assert assistant.metadata_ == original
    assert session.query(Message).filter(Message.conversation_id == conversation.id).count() == 2


@pytest.mark.asyncio
async def test_cancelled_regeneration_preserves_previous_assistant_response(session: Session, monkeypatch) -> None:
    """Cancelling regeneration before completion leaves the selected assistant untouched."""
    app.dependency_overrides[get_db] = lambda: session
    client = TestClient(app)
    _headers(client)
    actor = session.query(User).one()
    service = ConversationService(ConversationRepository(session))
    conversation = service.create_conversation(actor)
    service.add_user_message(actor, conversation.id, "Keep me")
    assistant = service.add_assistant_message(actor, conversation.id, "Original")
    monkeypatch.setattr(chat_routes, "_orchestrator", lambda _session: _StreamOrchestrator(["partial"]))

    response = await chat_routes.regenerate_stream(
        ChatRegenerateRequest(conversation_id=conversation.id, assistant_message_id=assistant.id),
        actor,
        session,
    )
    iterator = response.body_iterator
    assert "partial" in await anext(iterator)
    await iterator.aclose()
    app.dependency_overrides.clear()

    session.refresh(assistant)
    assert assistant.content == "Original"
    assert session.query(Message).filter(Message.conversation_id == conversation.id).count() == 2


def test_regeneration_does_not_cross_tenants(session: Session, monkeypatch) -> None:
    """Another tenant cannot discover or replace an assistant message."""
    app.dependency_overrides[get_db] = lambda: session
    client = TestClient(app)
    first_headers = _headers(client, "first", "admin@first.com")
    first_actor = session.query(User).filter(User.email == "admin@first.com").one()
    service = ConversationService(ConversationRepository(session))
    conversation = service.create_conversation(first_actor)
    service.add_user_message(first_actor, conversation.id, "Private prompt")
    assistant = service.add_assistant_message(first_actor, conversation.id, "Private answer")
    second_headers = _headers(client, "second", "admin@second.com")
    monkeypatch.setattr(chat_routes, "_orchestrator", lambda _session: _StreamOrchestrator(["stolen"]))

    response = client.post(
        "/chat/regenerate/stream",
        json={"conversation_id": str(conversation.id), "assistant_message_id": str(assistant.id)},
        headers=second_headers,
    )
    still_visible = client.get(f"/conversations/{conversation.id}", headers=first_headers)
    app.dependency_overrides.clear()

    assert response.status_code == 404
    assert still_visible.json()["messages"][-1]["content"] == "Private answer"
