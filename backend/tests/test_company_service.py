"""Authorization and tenant-isolation tests for company management."""

import pytest
from sqlalchemy.orm import Session

from app.database.models.enums import UserRole
from app.database.models.user import User
from app.schemas import RegisterRequest
from app.schemas.company import DepartmentCreateRequest
from app.services.auth_service import AuthService
from app.services.company_service import CompanyService, TenantAccessError


def test_manager_can_manage_only_employees_in_own_department(session: Session) -> None:
    """Manager assignment policy must not cross department or tenant boundaries."""
    auth_service = AuthService(session)
    company, admin, _ = auth_service.register_company_admin(RegisterRequest(company_name="Acme", company_slug="acme", first_name="Ada", last_name="Admin", email="admin@example.com", password="Correct-Horse-7-Battery!"))
    company_service = CompanyService(session)
    department = company_service.create_department(admin, DepartmentCreateRequest(name="Operations"))
    manager = User(company_id=company.id, department_id=department.id, role=UserRole.MANAGER, first_name="Mina", last_name="Manager", email="manager@example.com", password_hash="not-used")
    employee = User(company_id=company.id, role=UserRole.EMPLOYEE, first_name="Evan", last_name="Employee", email="employee@example.com", password_hash="not-used")
    other_company, _, _ = auth_service.register_company_admin(RegisterRequest(company_name="Other", company_slug="other", first_name="Owen", last_name="Owner", email="owner@example.com", password="Correct-Horse-7-Battery!"))
    outsider = User(company_id=other_company.id, role=UserRole.EMPLOYEE, first_name="Olive", last_name="Outsider", email="outsider@example.com", password_hash="not-used")
    session.add_all([manager, employee, outsider])
    session.commit()

    assigned = company_service.assign_department(manager, employee.id, department.id)
    assert assigned.department_id == department.id

    with pytest.raises(TenantAccessError):
        company_service.assign_department(manager, outsider.id, department.id)
    with pytest.raises(TenantAccessError):
        company_service.assign_department(manager, admin.id, department.id)
