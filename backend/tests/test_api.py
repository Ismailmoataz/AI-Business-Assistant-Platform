"""HTTP contract tests for Phase 1 endpoints."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.main import app


def test_registration_invalid_password_returns_422(session: Session) -> None:
    """Weak passwords must be rejected before account creation."""
    app.dependency_overrides[get_db] = lambda: session
    client = TestClient(app)
    response = client.post("/auth/register", json={"company_name": "Acme", "company_slug": "acme", "first_name": "Ada", "last_name": "Admin", "email": "admin@example.com", "password": "weak"})
    app.dependency_overrides.clear()

    assert response.status_code == 422


def test_registration_and_current_user_are_tenant_scoped(session: Session) -> None:
    """The access token resolves to its server-side user and company identity."""
    app.dependency_overrides[get_db] = lambda: session
    client = TestClient(app)
    response = client.post("/auth/register", json={"company_name": "Acme", "company_slug": "acme", "first_name": "Ada", "last_name": "Admin", "email": "admin@example.com", "password": "Correct-Horse-7-Battery!"})
    app.dependency_overrides.clear()

    assert response.status_code == 201
    token = response.json()["tokens"]["access_token"]
    app.dependency_overrides[get_db] = lambda: session
    me_response = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    app.dependency_overrides.clear()
    assert me_response.status_code == 200
    assert me_response.json()["company_id"] == response.json()["company"]["id"]

def test_google_authorization_fails_gracefully_when_not_configured(session: Session) -> None:
    """Missing Google credentials must return a safe service-unavailable response."""
    app.dependency_overrides[get_db] = lambda: session
    client = TestClient(app)
    response = client.get("/auth/google/authorize-url")
    app.dependency_overrides.clear()

    assert response.status_code == 503
