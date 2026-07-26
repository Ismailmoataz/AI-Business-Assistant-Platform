"""Executive dashboard integration and authorization tests."""

from collections.abc import AsyncIterator
from datetime import date, timedelta
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.ai.providers import ChatProvider, ChatResult
from app.api.routes.dashboard import get_dashboard_chat_provider
from app.database.connection import get_db
from app.database.models.documents import Document, DocumentVersion
from app.database.models.enums import DocumentVisibility
from app.main import app


class RecordingDashboardProvider(ChatProvider):
    """Deterministic provider that records the authorized dashboard prompt."""

    def __init__(self) -> None:
        self.messages: list[dict[str, str]] = []

    async def complete(self, messages: list[dict[str, str]]) -> ChatResult:
        self.messages = messages
        return ChatResult("• Launch is active.\n• One overdue task needs attention.\n• Document processing needs review.\n• Contoso is a recent customer.")

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        if messages:
            yield "unused"

    async def health_check(self) -> None:
        return None


def _register(client: TestClient, slug: str, email: str) -> tuple[dict[str, str], dict[str, str]]:
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
    payload = response.json()
    return {"Authorization": f"Bearer {payload['tokens']['access_token']}"}, payload["user"]


def test_dashboard_overview_uses_live_tenant_data_and_ai_provider(session: Session) -> None:
    """The overview connects every core widget to authorized live data."""
    provider = RecordingDashboardProvider()
    app.dependency_overrides[get_db] = lambda: session
    app.dependency_overrides[get_dashboard_chat_provider] = lambda: provider
    client = TestClient(app)
    headers, user = _register(client, "acme-dashboard", "dashboard@acme.com")

    project = client.post(
        "/projects",
        json={
            "name": "Launch program",
            "status": "active",
            "end_date": (date.today() + timedelta(days=5)).isoformat(),
            "tag_ids": [],
        },
        headers=headers,
    )
    assert project.status_code == 201
    task = client.post(
        "/tasks",
        json={
            "project_id": project.json()["id"],
            "title": "Resolve launch blocker",
            "assignee_id": user["id"],
            "status": "blocked",
            "priority": "urgent",
            "progress": 20,
            "due_date": (date.today() - timedelta(days=1)).isoformat(),
            "tag_ids": [],
        },
        headers=headers,
    )
    customer = client.post(
        "/customers",
        json={"customer_type": "company", "name": "Contoso", "status": "active", "tag_ids": []},
        headers=headers,
    )
    note = client.post(
        "/notes",
        json={"scope": "company", "title": "Launch decisions", "body": "Approved launch facts only.", "tag_ids": []},
        headers=headers,
    )
    conversation = client.post("/conversations", json={"title": "Launch review"}, headers=headers)
    assert task.status_code == customer.status_code == note.status_code == conversation.status_code == 201

    document = Document(
        company_id=UUID(user["company_id"]),
        owner_id=UUID(user["id"]),
        title="Launch brief",
        filename="launch.pdf",
        mime_type="application/pdf",
        size_bytes=2048,
        visibility=DocumentVisibility.COMPANY,
        object_key=f"{user['company_id']}/dashboard/launch.pdf",
        processing_status="failed",
    )
    session.add(document)
    session.flush()
    session.add(DocumentVersion(
        document_id=document.id,
        uploaded_by_user_id=UUID(user["id"]),
        version=1,
        filename=document.filename,
        mime_type=document.mime_type,
        size_bytes=document.size_bytes,
        object_key=document.object_key,
    ))
    session.commit()

    response = client.get("/dashboard/overview", headers=headers)
    app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["brief"]["status"] == "generated"
    assert payload["company"]["name"] == "Acme-Dashboard"
    assert payload["company"]["slug"] == "acme-dashboard"
    assert payload["kpis"] == {
        "active_projects": 1,
        "open_tasks": 1,
        "completed_tasks": 0,
        "employees": 1,
        "customers": 1,
        "documents": 1,
        "storage_bytes": 2048,
        "ai_conversations": 1,
        "notes": 1,
    }
    assert payload["my_work"]["overdue"] == 1
    assert payload["my_work"]["items"][0]["project_name"] == "Launch program"
    assert payload["documents"]["failed"] == 1
    assert payload["projects"][0]["health"] == "at_risk"
    assert payload["customers"]["recently_added"][0]["name"] == "Contoso"
    assert payload["conversations"][0]["title"] == "Launch review"
    assert "Launch program" in provider.messages[-1]["content"]
    assert "Contoso" in provider.messages[-1]["content"]


def test_dashboard_fallback_is_tenant_isolated_and_employee_customer_data_is_restricted(session: Session) -> None:
    """Fallback summaries stay useful without AI and never broaden role or tenant visibility."""
    app.dependency_overrides[get_db] = lambda: session
    app.dependency_overrides[get_dashboard_chat_provider] = lambda: None
    client = TestClient(app)
    acme_headers, _ = _register(client, "acme-scope", "admin@acme-scope.com")
    other_headers, _ = _register(client, "other-scope", "admin@other-scope.com")

    customer = client.post(
        "/customers",
        json={"customer_type": "company", "name": "Acme Secret Customer", "tag_ids": []},
        headers=acme_headers,
    )
    company_note = client.post(
        "/notes",
        json={"scope": "company", "title": "Management note", "body": "Not visible to unassigned employees.", "tag_ids": []},
        headers=acme_headers,
    )
    invitation = client.post("/invitations", json={"email": "employee@acme-scope.com", "role": "employee"}, headers=acme_headers)
    employee_tokens = client.post(
        "/invitations/accept",
        json={
            "token": invitation.json()["invitation_token"],
            "first_name": "Eve",
            "last_name": "Employee",
            "password": "Correct-Horse-8-Battery!",
        },
    )
    employee_headers = {"Authorization": f"Bearer {employee_tokens.json()['access_token']}"}
    assert customer.status_code == company_note.status_code == invitation.status_code == employee_tokens.status_code == 201

    other = client.get("/dashboard/overview", headers=other_headers)
    employee = client.get("/dashboard/overview", headers=employee_headers)
    app.dependency_overrides.clear()

    assert other.status_code == employee.status_code == 200
    assert other.json()["brief"]["status"] == "fallback"
    assert other.json()["kpis"]["customers"] == 0
    assert "Acme Secret Customer" not in str(other.json())
    assert employee.json()["kpis"]["customers"] is None
    assert employee.json()["kpis"]["notes"] == 0
    assert "Management note" not in str(employee.json())
    assert employee.json()["customers"]["available"] is False
    assert employee.json()["customers"]["recently_added"] == []
