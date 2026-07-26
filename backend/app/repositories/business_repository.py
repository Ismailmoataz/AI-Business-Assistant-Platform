"""Persistence operations for tenant-scoped business entities."""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, selectinload

from app.database.models.business import Activity, Customer, Note, Project, Tag, Task


class BusinessRepository:
    """Provides reusable company-scoped persistence and pagination queries."""

    def __init__(self, session: Session) -> None:
        """Bind the repository to a request unit of work."""
        self._session = session

    def add(self, entity: object) -> None:
        """Stage an entity for persistence."""
        self._session.add(entity)

    def get_tag(self, company_id: UUID, tag_id: UUID) -> Tag | None:
        """Return an active tag from one tenant."""
        return self._session.scalar(
            select(Tag)
            .options(selectinload(Tag.customers), selectinload(Tag.projects), selectinload(Tag.tasks), selectinload(Tag.notes))
            .where(Tag.company_id == company_id, Tag.id == tag_id, Tag.deleted_at.is_(None))
        )

    def get_tags(self, company_id: UUID, tag_ids: list[UUID]) -> list[Tag]:
        """Return all requested active tenant tags."""
        if not tag_ids:
            return []
        return list(self._session.scalars(select(Tag).where(Tag.company_id == company_id, Tag.id.in_(tag_ids), Tag.deleted_at.is_(None))))

    def get_customer(self, company_id: UUID, entity_id: UUID) -> Customer | None:
        """Return a non-deleted customer with tags."""
        return self._session.scalar(select(Customer).options(selectinload(Customer.tags)).where(Customer.company_id == company_id, Customer.id == entity_id, Customer.deleted_at.is_(None)))

    def get_project(self, company_id: UUID, entity_id: UUID) -> Project | None:
        """Return a non-deleted project with tags."""
        return self._session.scalar(select(Project).options(selectinload(Project.tags)).where(Project.company_id == company_id, Project.id == entity_id, Project.deleted_at.is_(None)))

    def get_task(self, company_id: UUID, entity_id: UUID) -> Task | None:
        """Return a non-deleted task with tags and comments."""
        return self._session.scalar(
            select(Task)
            .options(selectinload(Task.tags), selectinload(Task.comments))
            .execution_options(populate_existing=True)
            .where(Task.company_id == company_id, Task.id == entity_id, Task.deleted_at.is_(None))
        )

    def get_note(self, company_id: UUID, entity_id: UUID) -> Note | None:
        """Return a non-deleted note from one tenant."""
        return self._session.scalar(
            select(Note).options(selectinload(Note.tags)).where(Note.company_id == company_id, Note.id == entity_id, Note.deleted_at.is_(None))
        )

    def get_activity(self, company_id: UUID, entity_id: UUID) -> Activity | None:
        """Return an activity event from one tenant."""
        return self._session.scalar(select(Activity).where(Activity.company_id == company_id, Activity.id == entity_id))

    def page(self, statement: Select, offset: int, limit: int) -> tuple[Sequence[object], int]:
        """Execute a select statement with a matching total count."""
        total = self._session.scalar(select(func.count()).select_from(statement.order_by(None).subquery())) or 0
        return self._session.scalars(statement.offset(offset).limit(limit)).unique().all(), total
