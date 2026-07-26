"""Company persistence operations."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models.company import Company


class CompanyRepository:
    """Encapsulates company queries within an explicit database session."""

    def __init__(self, session: Session) -> None:
        """Create a repository bound to one unit-of-work session."""
        self._session = session

    def get_by_slug(self, slug: str) -> Company | None:
        """Return the company with a slug, if it exists."""
        return self._session.scalar(select(Company).where(Company.slug == slug))

    def get_by_id(self, company_id: UUID) -> Company | None:
        """Return one company by primary key."""
        return self._session.get(Company, company_id)

    def add(self, company: Company) -> None:
        """Stage a company for persistence."""
        self._session.add(company)
