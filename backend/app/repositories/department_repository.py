"""Department persistence operations."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models.department import Department


class DepartmentRepository:
    """Encapsulates tenant-scoped department queries."""

    def __init__(self, session: Session) -> None:
        """Create a repository bound to one unit-of-work session."""
        self._session = session

    def get_for_company(self, department_id: UUID, company_id: UUID) -> Department | None:
        """Return a department only when it belongs to the specified company."""
        return self._session.scalar(select(Department).where(Department.id == department_id, Department.company_id == company_id))

    def list_for_company(self, company_id: UUID) -> list[Department]:
        """Return all departments for one tenant in stable name order."""
        return list(self._session.scalars(select(Department).where(Department.company_id == company_id).order_by(Department.name)))

    def add(self, department: Department) -> None:
        """Stage a department for persistence."""
        self._session.add(department)
