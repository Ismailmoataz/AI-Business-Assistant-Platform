"""Phase 2 service tests for CRUD, tenant isolation, validation, and role policy."""

from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.database.models.enums import NoteScope, TaskStatus, UserRole
from app.database.models.user import User
from app.schemas import RegisterRequest
from app.schemas.business import (
    CustomerCreateRequest, NoteCreateRequest, ProjectCreateRequest, TagCreateRequest, TaskCreateRequest, TaskUpdateRequest,
)
from app.schemas.company import DepartmentCreateRequest
from app.services.auth_service import AuthService
from app.services.business_service import BusinessNotFoundError, BusinessPermissionError, BusinessService, BusinessValidationError
from app.services.company_service import CompanyService


def _company_with_team(session: Session) -> tuple[User, User, User, object]:
    """Create a tenant with one admin, department manager, and employee."""
    auth = AuthService(session)
    company, admin, _ = auth.register_company_admin(RegisterRequest(company_name="Acme", company_slug="acme", first_name="Ada", last_name="Admin", email="admin@example.com", password="Correct-Horse-7-Battery!"))
    department = CompanyService(session).create_department(admin, DepartmentCreateRequest(name="Operations"))
    manager = User(company_id=company.id, department_id=department.id, role=UserRole.MANAGER, first_name="Mina", last_name="Manager", email="manager@example.com", password_hash="unused")
    employee = User(company_id=company.id, department_id=department.id, role=UserRole.EMPLOYEE, first_name="Evan", last_name="Employee", email="employee@example.com", password_hash="unused")
    session.add_all([manager, employee])
    session.commit()
    return admin, manager, employee, department


def test_business_crud_creates_tags_customer_project_task_comment_and_activity(session: Session) -> None:
    """An administrator can create the core records and their activity history."""
    admin, _, employee, department = _company_with_team(session)
    service = BusinessService(session)
    tag = service.create_tag(admin, TagCreateRequest(name="priority", color="#0A88CC"))
    customer = service.create_customer(admin, CustomerCreateRequest(customer_type="company", name="Northwind", tag_ids=[tag.id]))
    project = service.create_project(admin, ProjectCreateRequest(name="Launch", owner_id=employee.id, department_id=department.id, start_date=date(2026, 1, 1), tag_ids=[tag.id]))
    task = service.create_task(admin, TaskCreateRequest(project_id=project.id, title="Prepare plan", assignee_id=employee.id, tag_ids=[tag.id]))
    comment = service.add_comment(employee, task.id, type("Payload", (), {"body": "Started work"})())
    updated = service.update_task(employee, task.id, TaskUpdateRequest(status=TaskStatus.IN_PROGRESS, progress=25))

    assert customer.tags[0].id == tag.id
    assert project.tags[0].id == tag.id
    assert updated.progress == 25
    assert comment.author_id == employee.id
    activities, total = service.list_activities(admin, 0, 100, None)
    assert total >= 6
    assert {item.entity_type for item in activities} >= {"tag", "customer", "project", "task", "taskcomment"}


def test_employee_cannot_manage_customers_or_project_but_can_update_assigned_task(session: Session) -> None:
    """Employee permissions restrict management actions while preserving assigned work."""
    admin, _, employee, department = _company_with_team(session)
    service = BusinessService(session)
    project = service.create_project(admin, ProjectCreateRequest(name="Launch", owner_id=employee.id, department_id=department.id))
    task = service.create_task(admin, TaskCreateRequest(project_id=project.id, title="Prepare plan", assignee_id=employee.id))

    with pytest.raises(BusinessPermissionError):
        service.create_customer(employee, CustomerCreateRequest(customer_type="company", name="Blocked"))
    with pytest.raises(BusinessPermissionError):
        service.create_project(employee, ProjectCreateRequest(name="Blocked"))
    updated = service.update_task(employee, task.id, TaskUpdateRequest(status=TaskStatus.DONE, progress=100))
    assert updated.status == TaskStatus.DONE
    with pytest.raises(BusinessPermissionError):
        service.update_task(employee, task.id, TaskUpdateRequest(title="Not permitted"))


def test_cross_tenant_references_and_visibility_are_rejected(session: Session) -> None:
    """Business references and reads must never cross a tenant boundary."""
    admin, _, employee, department = _company_with_team(session)
    auth = AuthService(session)
    other_company, other_admin, _ = auth.register_company_admin(RegisterRequest(company_name="Other", company_slug="other", first_name="Owen", last_name="Owner", email="owner@example.com", password="Correct-Horse-7-Battery!"))
    service = BusinessService(session)
    other_tag = service.create_tag(other_admin, TagCreateRequest(name="other"))
    with pytest.raises(BusinessValidationError):
        service.create_customer(admin, CustomerCreateRequest(customer_type="company", name="Acme customer", tag_ids=[other_tag.id]))
    project = service.create_project(admin, ProjectCreateRequest(name="Visible", owner_id=employee.id, department_id=department.id))
    with pytest.raises(BusinessNotFoundError):
        service.get_project(other_admin, project.id)
    assert other_company.id != admin.company_id


def test_note_scope_validation_and_soft_delete(session: Session) -> None:
    """Notes validate scope and deleted records disappear from active lists."""
    admin, _, _, _ = _company_with_team(session)
    service = BusinessService(session)
    note = service.create_note(admin, NoteCreateRequest(scope=NoteScope.COMPANY, title="Policy", body="Keep records current"))
    service.delete_note(admin, note.id)
    with pytest.raises(BusinessNotFoundError):
        service.get_note(admin, note.id)
    with pytest.raises(ValueError):
        NoteCreateRequest(scope=NoteScope.PROJECT, title="Bad", body="Missing project")
