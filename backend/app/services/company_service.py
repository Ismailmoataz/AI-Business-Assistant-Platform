"""Tenant-safe company and department management workflows."""

from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.models.department import Department
from app.database.models.enums import UserRole
from app.database.models.user import User
from app.repositories.department_repository import DepartmentRepository
from app.repositories.user_repository import UserRepository
from app.schemas.company import DepartmentCreateRequest


class TenantAccessError(Exception):
    """Raised when an operation crosses a company or manager-department boundary."""


class DepartmentConflictError(Exception):
    """Raised when a company already has a department with the requested name."""


class CompanyService:
    """Coordinates company-scoped department and user assignments."""

    def __init__(self, session: Session) -> None:
        """Create the service and its tenant-aware repositories."""
        self._session = session
        self._departments = DepartmentRepository(session)
        self._users = UserRepository(session)

    def create_department(self, actor: User, payload: DepartmentCreateRequest) -> Department:
        """Create a department in the actor's company."""
        department = Department(company_id=actor.company_id, name=payload.name.strip(), description=payload.description.strip() if payload.description else None)
        self._departments.add(department)
        try:
            self._session.commit()
        except IntegrityError as exc:
            self._session.rollback()
            raise DepartmentConflictError("Department name is already in use") from exc
        self._session.refresh(department)
        return department

    def list_departments(self, actor: User) -> list[Department]:
        """List departments visible within the actor's company."""
        return self._departments.list_for_company(actor.company_id)

    def assign_department(self, actor: User, target_user_id: UUID, department_id: UUID | None) -> User:
        """Assign a same-company user to a permitted department or clear assignment."""
        target = self._users.get_for_company(target_user_id, actor.company_id)
        if target is None:
            raise TenantAccessError("User was not found in the current company")
        department = self._departments.get_for_company(department_id, actor.company_id) if department_id else None
        if department_id and department is None:
            raise TenantAccessError("Department was not found in the current company")
        if actor.role == UserRole.MANAGER:
            if actor.department_id is None or target.role != UserRole.EMPLOYEE:
                raise TenantAccessError("Managers may manage employee users in their own department only")
            if (department_id is not None and department_id != actor.department_id) or target.department_id not in (None, actor.department_id):
                raise TenantAccessError("Managers may manage employee users in their own department only")
        target.department_id = department.id if department else None
        self._session.commit()
        self._session.refresh(target)
        return target
