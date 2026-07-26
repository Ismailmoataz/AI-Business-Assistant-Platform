"""HTTP integration tests for Phase 2 validation and authorization contracts."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.main import app


def _register(client: TestClient) -> dict[str, str]:
    """Register an isolated administrator and return bearer headers."""
    response = client.post("/auth/register", json={"company_name": "Acme", "company_slug": "acme", "first_name": "Ada", "last_name": "Admin", "email": "admin@acme.com", "password": "Correct-Horse-7-Battery!"})
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['tokens']['access_token']}"}


def test_business_crud_endpoints_validate_and_soft_delete(session: Session) -> None:
    """Customer and tag endpoints return correct success and validation statuses."""
    app.dependency_overrides[get_db] = lambda: session
    client = TestClient(app)
    headers = _register(client)
    invalid = client.post("/tags", json={"name": "bad", "color": "red"}, headers=headers)
    tag = client.post("/tags", json={"name": "vip", "color": "#123ABC"}, headers=headers)
    customer = client.post("/customers", json={"customer_type": "company", "name": "Northwind", "tag_ids": [tag.json()["id"]]}, headers=headers)
    listed = client.get("/customers?search=North", headers=headers)
    deleted = client.delete(f"/customers/{customer.json()['id']}", headers=headers)
    missing = client.get(f"/customers/{customer.json()['id']}", headers=headers)
    app.dependency_overrides.clear()

    assert invalid.status_code == 422
    assert tag.status_code == 201
    assert customer.status_code == 201
    assert listed.json()["page"]["total"] == 1
    assert deleted.status_code == 204
    assert missing.status_code == 404


def test_project_task_workspace_contract_supports_search_filters_review_comments_and_activity(session: Session) -> None:
    """Phase 5D query and detail contracts remain tenant-authorized and server-backed."""
    app.dependency_overrides[get_db] = lambda: session
    client = TestClient(app)
    headers = _register(client)

    tag = client.post("/tags", json={"name": "launch", "color": "#5B5BD6"}, headers=headers)
    project = client.post(
        "/projects",
        json={"name": "Website launch", "description": "Public launch plan", "tag_ids": [tag.json()["id"]]},
        headers=headers,
    )
    task = client.post(
        "/tasks",
        json={
            "project_id": project.json()["id"],
            "title": "Review launch checklist",
            "status": "review",
            "priority": "urgent",
            "tag_ids": [tag.json()["id"]],
        },
        headers=headers,
    )
    comment = client.post(
        f"/tasks/{task.json()['id']}/comments",
        json={"body": "Ready for stakeholder review"},
        headers=headers,
    )

    projects = client.get(
        f"/projects?search=Public&tag_id={tag.json()['id']}&sort=name",
        headers=headers,
    )
    tasks = client.get(
        f"/tasks?search=checklist&status=review&priority=urgent&tag_id={tag.json()['id']}&sort=priority",
        headers=headers,
    )
    detail = client.get(f"/tasks/{task.json()['id']}", headers=headers)
    activity = client.get(
        f"/activity?entity_type=task&entity_id={task.json()['id']}",
        headers=headers,
    )
    app.dependency_overrides.clear()

    assert tag.status_code == 201
    assert project.status_code == 201
    assert task.status_code == 201
    assert comment.status_code == 201
    assert projects.status_code == 200 and projects.json()["page"]["total"] == 1
    assert tasks.status_code == 200 and tasks.json()["page"]["total"] == 1
    assert detail.status_code == 200
    assert detail.json()["comments"][0]["body"] == "Ready for stakeholder review"
    assert activity.status_code == 200 and activity.json()["page"]["total"] == 1


def test_business_workspace_part_two_supports_relationships_filters_usage_and_activity(session: Session) -> None:
    """Phase 5D Part 2 APIs power tenant-scoped directories, linked notes, and tag usage."""
    app.dependency_overrides[get_db] = lambda: session
    client = TestClient(app)
    headers = _register(client)

    tag = client.post("/tags", json={"name": "strategic", "color": "#3344AA"}, headers=headers)
    customer = client.post(
        "/customers",
        json={"customer_type": "company", "name": "Contoso", "status": "active", "contact_name": "Sam Lee", "tag_ids": [tag.json()["id"]]},
        headers=headers,
    )
    project = client.post(
        "/projects",
        json={"name": "Contoso expansion", "customer_id": customer.json()["id"], "tag_ids": [tag.json()["id"]]},
        headers=headers,
    )
    note = client.post(
        "/notes",
        json={"scope": "company", "title": "Expansion brief", "body": "Strategic relationship context", "customer_id": customer.json()["id"], "tag_ids": [tag.json()["id"]]},
        headers=headers,
    )

    employees = client.get("/employees?role=admin&status=active&sort=updated", headers=headers)
    customers = client.get(f"/customers?customer_type=company&status=active&tag_id={tag.json()['id']}&sort=updated", headers=headers)
    projects = client.get(f"/projects?customer_id={customer.json()['id']}", headers=headers)
    notes = client.get(f"/notes?search=relationship&customer_id={customer.json()['id']}&tag_id={tag.json()['id']}&sort=title", headers=headers)
    tag_detail = client.get(f"/tags/{tag.json()['id']}", headers=headers)
    note_activity = client.get(f"/activity?entity_type=note&entity_id={note.json()['id']}", headers=headers)
    tag_activity = client.get(f"/activity?entity_type=tag&entity_id={tag.json()['id']}", headers=headers)
    app.dependency_overrides.clear()

    assert tag.status_code == 201 and customer.status_code == 201 and project.status_code == 201 and note.status_code == 201
    assert employees.status_code == 200 and employees.json()["page"]["total"] == 1
    assert employees.json()["items"][0]["department_name"] is None
    assert customers.status_code == 200 and customers.json()["items"][0]["name"] == "Contoso"
    assert projects.status_code == 200 and projects.json()["items"][0]["customer_id"] == customer.json()["id"]
    assert notes.status_code == 200 and notes.json()["items"][0]["customer_id"] == customer.json()["id"]
    assert tag_detail.status_code == 200
    assert tag_detail.json()["customer_count"] == 1
    assert tag_detail.json()["project_count"] == 1
    assert tag_detail.json()["note_count"] == 1
    assert note_activity.status_code == 200 and note_activity.json()["page"]["total"] == 1
    assert tag_activity.status_code == 200 and tag_activity.json()["page"]["total"] == 1
