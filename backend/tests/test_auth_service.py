"""Integration-style tests for transactional identity workflows."""

import pytest
from sqlalchemy.orm import Session

from app.database.models.department import Department
from app.database.models.enums import UserRole
from app.repositories.user_repository import UserRepository
from app.schemas import InvitationAcceptRequest, InvitationCreateRequest, LoginRequest, RegisterRequest
from app.services.auth_service import AuthService, AuthenticationError, DomainConflictError, TokenValidationError


def register_payload(email: str = "admin@example.com", slug: str = "acme") -> RegisterRequest:
    """Build a valid administrator registration request."""
    return RegisterRequest(company_name="Acme", company_slug=slug, first_name="Ada", last_name="Admin", email=email, password="Correct-Horse-7-Battery!")


def test_register_login_refresh_and_logout(session: Session) -> None:
    """Authentication tokens rotate and cannot be reused after rotation or logout."""
    service = AuthService(session)
    _, user, tokens = service.register_company_admin(register_payload())

    assert user.role == UserRole.ADMIN
    login_tokens = service.login(LoginRequest(email="admin@example.com", password="Correct-Horse-7-Battery!"))
    rotated_tokens = service.refresh(login_tokens.refresh_token)
    with pytest.raises(AuthenticationError):
        service.refresh(login_tokens.refresh_token)
    service.logout(rotated_tokens.refresh_token)
    with pytest.raises(AuthenticationError):
        service.refresh(rotated_tokens.refresh_token)


def test_duplicate_company_slug_and_email_are_rejected(session: Session) -> None:
    """Tenant slugs and login emails remain globally unique."""
    service = AuthService(session)
    service.register_company_admin(register_payload())

    with pytest.raises(DomainConflictError):
        service.register_company_admin(register_payload(email="other@example.com"))
    with pytest.raises(DomainConflictError):
        service.register_company_admin(register_payload(email="admin@example.com", slug="other"))


def test_password_reset_revokes_existing_refresh_tokens(session: Session) -> None:
    """A reset token is one-time and invalidates all active sessions."""
    service = AuthService(session)
    service.register_company_admin(register_payload())
    tokens = service.login(LoginRequest(email="admin@example.com", password="Correct-Horse-7-Battery!"))
    reset_token = service.request_password_reset("admin@example.com")

    assert reset_token is not None
    service.confirm_password_reset(reset_token, "New-Correct-9-Password!")
    with pytest.raises(AuthenticationError):
        service.refresh(tokens.refresh_token)
    assert service.login(LoginRequest(email="admin@example.com", password="New-Correct-9-Password!"))
    with pytest.raises(TokenValidationError):
        service.confirm_password_reset(reset_token, "Another-Correct-9-Password!")


def test_invitation_cannot_cross_company_department_boundary(session: Session) -> None:
    """An administrator cannot attach an invite to another tenant's department."""
    service = AuthService(session)
    _, first_admin, _ = service.register_company_admin(register_payload())
    other_company, _, _ = service.register_company_admin(register_payload(email="other@example.com", slug="other"))
    foreign_department = Department(company_id=other_company.id, name="Foreign")
    session.add(foreign_department)
    session.commit()

    with pytest.raises(TokenValidationError):
        service.create_invitation(first_admin, InvitationCreateRequest(email="invitee@example.com", department_id=foreign_department.id))


def test_accepted_invitation_creates_user_in_inviter_company(session: Session) -> None:
    """Invitation acceptance derives company and role from server-side invitation data."""
    service = AuthService(session)
    _, admin, _ = service.register_company_admin(register_payload())
    invitation, raw_token = service.create_invitation(admin, InvitationCreateRequest(email="employee@example.com", role=UserRole.EMPLOYEE))
    user, _ = service.accept_invitation(InvitationAcceptRequest(token=raw_token, first_name="Eve", last_name="Employee", password="Correct-Horse-7-Battery!"))

    assert user.company_id == admin.company_id == invitation.company_id
    assert user.role == UserRole.EMPLOYEE
    assert UserRepository(session).get_by_email("employee@example.com").company_id == admin.company_id
