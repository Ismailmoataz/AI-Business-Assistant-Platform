"""User persistence operations."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models.user import User


class UserRepository:
    """Encapsulates tenant-aware user queries."""

    def __init__(self, session: Session) -> None:
        """Create a repository bound to one unit-of-work session."""
        self._session = session

    def get_by_email(self, email: str) -> User | None:
        """Return a user by normalized email address."""
        return self._session.scalar(select(User).where(User.email == email))

    def get_by_id(self, user_id: UUID) -> User | None:
        """Return a user by primary key."""
        return self._session.get(User, user_id)

    def get_for_company(self, user_id: UUID, company_id: UUID) -> User | None:
        """Return a user only when it belongs to the specified company."""
        return self._session.scalar(select(User).where(User.id == user_id, User.company_id == company_id))

    def add(self, user: User) -> None:
        """Stage a user for persistence."""
        self._session.add(user)
