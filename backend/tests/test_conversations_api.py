"""HTTP coverage for conversation previews, renaming, deletion, and ownership."""

from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models.user import User
from app.main import app
from app.repositories.conversation_repository import ConversationRepository
from app.services.conversation_service import ConversationService


def _register(client: TestClient, slug: str, email: str) -> tuple[dict[str, str], str]:
    """Register one tenant administrator and return headers plus user ID."""
    response = client.post(
        "/auth/register",
        json={
            "company_name": slug.title(),
            "company_slug": slug,
            "first_name": "Ada",
            "last_name": "Admin",
            "email": email,
            "password": "Correct-Horse-7-Battery!",
        },
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['tokens']['access_token']}"}, response.json()["user"]["id"]


def test_conversation_list_preview_rename_and_delete(session: Session) -> None:
    """Conversation management exposes previews and updates the owned resource contract."""
    app.dependency_overrides[get_db] = lambda: session
    client = TestClient(app)
    headers, user_id = _register(client, "acme", "admin@acme.com")
    created = client.post("/conversations", json={}, headers=headers)
    conversation_id = UUID(created.json()["id"])
    actor = session.get(User, UUID(user_id))
    assert actor is not None
    service = ConversationService(ConversationRepository(session))
    service.add_user_message(actor, conversation_id, "Summarize the quarterly launch plan and its risks")
    service.add_assistant_message(actor, conversation_id, "Here is the latest launch plan summary.")

    listed = client.get("/conversations", headers=headers)
    renamed = client.patch(
        f"/conversations/{created.json()['id']}",
        json={"title": "  Launch planning  "},
        headers=headers,
    )
    deleted = client.delete(f"/conversations/{created.json()['id']}", headers=headers)
    missing = client.get(f"/conversations/{created.json()['id']}", headers=headers)
    app.dependency_overrides.clear()

    assert listed.status_code == 200
    assert listed.json()["items"][0]["last_message_preview"] == "Here is the latest launch plan summary."
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Launch planning"
    assert renamed.json()["last_message_preview"] == "Here is the latest launch plan summary."
    assert deleted.status_code == 204
    assert missing.status_code == 404


def test_conversation_mutations_do_not_cross_tenants(session: Session) -> None:
    """Rename and delete return not-found for another tenant's conversation."""
    app.dependency_overrides[get_db] = lambda: session
    client = TestClient(app)
    first_headers, _ = _register(client, "first", "admin@first.com")
    second_headers, _ = _register(client, "second", "admin@second.com")
    conversation_id = client.post("/conversations", json={"title": "Private"}, headers=first_headers).json()["id"]

    renamed = client.patch(f"/conversations/{conversation_id}", json={"title": "Changed"}, headers=second_headers)
    deleted = client.delete(f"/conversations/{conversation_id}", headers=second_headers)
    still_present = client.get(f"/conversations/{conversation_id}", headers=first_headers)
    app.dependency_overrides.clear()

    assert renamed.status_code == 404
    assert deleted.status_code == 404
    assert still_present.status_code == 200


def test_conversation_search_matches_titles_and_full_message_history_with_pagination(session: Session) -> None:
    """Server search covers titles and any message while retaining a stable paginated total."""
    app.dependency_overrides[get_db] = lambda: session
    client = TestClient(app)
    headers, user_id = _register(client, "search", "admin@search.com")
    actor = session.get(User, UUID(user_id))
    assert actor is not None
    service = ConversationService(ConversationRepository(session))

    title_match = service.create_conversation(actor, "Quarterly forecast")
    service.add_user_message(actor, title_match.id, "ordinary prompt")
    message_match = service.create_conversation(actor, "Operations")
    service.add_user_message(actor, message_match.id, "The archived quarterly assumptions are here")
    service.add_assistant_message(actor, message_match.id, "Quarterly risks and quarterly mitigations")
    no_match = service.create_conversation(actor, "Hiring")
    service.add_user_message(actor, no_match.id, "Interview plan")

    first_page = client.get("/conversations?search=QUARTERLY&offset=0&limit=1", headers=headers)
    second_page = client.get("/conversations?search=quarterly&offset=1&limit=1", headers=headers)
    chat_alias = client.get("/chat/conversations?search=quarterly&offset=0&limit=10", headers=headers)
    app.dependency_overrides.clear()

    expected = {str(title_match.id), str(message_match.id)}
    assert first_page.status_code == 200
    assert first_page.json()["page"]["total"] == 2
    assert second_page.json()["page"]["total"] == 2
    assert {first_page.json()["items"][0]["id"], second_page.json()["items"][0]["id"]} == expected
    assert {item["id"] for item in chat_alias.json()["items"]} == expected
    assert str(no_match.id) not in expected


def test_conversation_search_is_tenant_and_owner_isolated(session: Session) -> None:
    """Search never returns matching content owned by another tenant."""
    app.dependency_overrides[get_db] = lambda: session
    client = TestClient(app)
    first_headers, first_user_id = _register(client, "alpha", "admin@alpha.com")
    second_headers, second_user_id = _register(client, "beta", "admin@beta.com")
    service = ConversationService(ConversationRepository(session))
    first_actor = session.get(User, UUID(first_user_id))
    second_actor = session.get(User, UUID(second_user_id))
    assert first_actor is not None and second_actor is not None
    private = service.create_conversation(first_actor, "Secret launch")
    service.add_user_message(first_actor, private.id, "needle-private-content")
    own = service.create_conversation(second_actor, "Visible")
    service.add_user_message(second_actor, own.id, "needle-visible-content")

    first_results = client.get("/conversations?search=needle", headers=first_headers)
    second_results = client.get("/conversations?search=needle", headers=second_headers)
    app.dependency_overrides.clear()

    assert [item["id"] for item in first_results.json()["items"]] == [str(private.id)]
    assert [item["id"] for item in second_results.json()["items"]] == [str(own.id)]


def test_conversation_history_serializes_real_citations_and_legacy_fallback(session: Session) -> None:
    """History exposes structured citations while legacy messages safely return an empty list."""
    app.dependency_overrides[get_db] = lambda: session
    client = TestClient(app)
    headers, user_id = _register(client, "citations", "admin@citations.com")
    actor = session.get(User, UUID(user_id))
    assert actor is not None
    service = ConversationService(ConversationRepository(session))
    conversation = service.create_conversation(actor)
    service.add_user_message(actor, conversation.id, "Find the policy")
    document_id = UUID("123e4567-e89b-12d3-a456-426614174000")
    service.add_assistant_message(actor, conversation.id, "The policy applies.", {
        "citations": [{
            "document_id": str(document_id),
            "title": "Travel policy",
            "filename": "travel-policy.pdf",
            "chunk_index": 4,
            "similarity_score": 0.87,
        }],
        "private_internal_key": "not serialized",
    })

    response = client.get(f"/conversations/{conversation.id}", headers=headers)
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["messages"][0]["citations"] == []
    assert response.json()["messages"][1]["citations"] == [{
        "document_id": str(document_id),
        "title": "Travel policy",
        "filename": "travel-policy.pdf",
        "chunk_index": 4,
        "similarity_score": 0.87,
    }]
    assert "private_internal_key" not in response.text
