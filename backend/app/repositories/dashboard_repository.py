"""Bounded, tenant-authorized read models for the executive dashboard."""

from datetime import date

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database.models.business import Activity, Customer, Note, Project, Task
from app.database.models.conversations import Conversation
from app.database.models.documents import Document, DocumentVersion
from app.database.models.enums import DocumentVisibility, NoteScope, ProjectStatus, TaskStatus, UserRole
from app.database.models.user import User


class DashboardRepository:
    """Execute dashboard queries with authorization filters applied before limits."""

    def __init__(self, session: Session) -> None:
        self._session = session

    @staticmethod
    def _project_scope(actor: User):
        scope = [Project.company_id == actor.company_id, Project.deleted_at.is_(None)]
        if actor.role == UserRole.MANAGER:
            scope.append(or_(Project.department_id == actor.department_id, Project.owner_id == actor.id))
        elif actor.role == UserRole.EMPLOYEE:
            scope.append(or_(Project.owner_id == actor.id, Project.tasks.any(Task.assignee_id == actor.id)))
        return and_(*scope)

    @staticmethod
    def _task_scope(actor: User):
        scope = [Task.company_id == actor.company_id, Task.deleted_at.is_(None), Project.deleted_at.is_(None)]
        if actor.role == UserRole.MANAGER:
            scope.append(or_(Project.department_id == actor.department_id, Project.owner_id == actor.id))
        elif actor.role == UserRole.EMPLOYEE:
            scope.append(Task.assignee_id == actor.id)
        return and_(*scope)

    @staticmethod
    def _employee_scope(actor: User):
        scope = [User.company_id == actor.company_id]
        if actor.role == UserRole.MANAGER:
            scope.append(User.department_id == actor.department_id)
        return and_(*scope)

    @staticmethod
    def _document_scope(actor: User):
        if actor.role == UserRole.ADMIN:
            return Document.company_id == actor.company_id
        return and_(
            Document.company_id == actor.company_id,
            or_(
                Document.visibility == DocumentVisibility.COMPANY,
                Document.owner_id == actor.id,
                and_(
                    Document.visibility == DocumentVisibility.DEPARTMENT,
                    Document.department_id == actor.department_id,
                    actor.department_id is not None,
                ),
            ),
        )

    @staticmethod
    def _note_scope(actor: User):
        scope = [Note.company_id == actor.company_id, Note.deleted_at.is_(None)]
        if actor.role == UserRole.MANAGER:
            scope.append(
                or_(
                    Note.owner_id == actor.id,
                    Note.scope == NoteScope.COMPANY,
                    Note.project.has(or_(Project.department_id == actor.department_id, Project.owner_id == actor.id)),
                )
            )
        elif actor.role == UserRole.EMPLOYEE:
            scope.append(
                or_(
                    Note.owner_id == actor.id,
                    Note.project.has(or_(Project.owner_id == actor.id, Project.tasks.any(Task.assignee_id == actor.id))),
                )
            )
        return and_(*scope)

    def _count(self, statement) -> int:
        return int(self._session.scalar(select(func.count()).select_from(statement.subquery())) or 0)

    def kpis(self, actor: User) -> dict[str, int | None]:
        """Return exact KPI totals over the same scopes as their source workspaces."""
        projects = select(Project.id).where(self._project_scope(actor), Project.status == ProjectStatus.ACTIVE)
        tasks = select(Task.id, Task.status).join(Project).where(self._task_scope(actor))
        documents = select(Document.id, Document.size_bytes).where(self._document_scope(actor), Document.deleted_at.is_(None))
        employees = select(User.id).where(self._employee_scope(actor))
        conversations = select(Conversation.id).where(Conversation.company_id == actor.company_id, Conversation.owner_id == actor.id)
        notes = select(Note.id).where(self._note_scope(actor))
        customers = None
        if actor.role != UserRole.EMPLOYEE:
            customers = self._count(select(Customer.id).where(Customer.company_id == actor.company_id, Customer.deleted_at.is_(None)))
        storage_bytes = self._session.scalar(
            select(func.coalesce(func.sum(DocumentVersion.size_bytes), 0))
            .join(Document)
            .where(self._document_scope(actor), Document.deleted_at.is_(None))
        )
        return {
            "active_projects": self._count(projects),
            "open_tasks": self._count(tasks.where(Task.status != TaskStatus.DONE)),
            "completed_tasks": self._count(tasks.where(Task.status == TaskStatus.DONE)),
            "employees": self._count(employees),
            "customers": customers,
            "documents": self._count(documents),
            "storage_bytes": int(storage_bytes or 0),
            "ai_conversations": self._count(conversations),
            "notes": self._count(notes),
        }

    def my_work(self, actor: User, today: date, limit: int = 8) -> tuple[list[Task], dict[str, int]]:
        """Return open assignments and exact due-state totals for the current user."""
        base = select(Task).join(Project).where(
            self._task_scope(actor),
            Task.assignee_id == actor.id,
            Task.status != TaskStatus.DONE,
        )
        due_order = case(
            (Task.due_date < today, 0),
            (Task.due_date == today, 1),
            (Task.due_date.is_not(None), 2),
            else_=3,
        )
        items = list(self._session.scalars(base.options(selectinload(Task.project)).order_by(due_order, Task.due_date, Task.updated_at.desc()).limit(limit)))
        return items, {
            "assigned": self._count(base.with_only_columns(Task.id)),
            "due_today": self._count(base.with_only_columns(Task.id).where(Task.due_date == today)),
            "overdue": self._count(base.with_only_columns(Task.id).where(Task.due_date < today)),
            "upcoming": self._count(base.with_only_columns(Task.id).where(Task.due_date > today)),
        }

    def documents(self, actor: User, limit: int = 6) -> tuple[list[Document], dict[str, int]]:
        """Return recent visible documents and exact processing lifecycle totals."""
        base_filter = and_(self._document_scope(actor), Document.deleted_at.is_(None))
        items = list(self._session.scalars(select(Document).where(base_filter).order_by(Document.updated_at.desc()).limit(limit)))
        rows = self._session.execute(select(Document.processing_status, func.count(Document.id)).where(base_filter).group_by(Document.processing_status))
        counts = {"uploaded": 0, "processing": 0, "ready": 0, "failed": 0}
        for processing_status, count in rows:
            if processing_status in counts:
                counts[processing_status] = int(count)
        return items, counts

    def projects(self, actor: User, limit: int = 5) -> list[Project]:
        """Return visible current projects ordered by the nearest deadline."""
        return list(self._session.scalars(
            select(Project)
            .options(selectinload(Project.tasks))
            .where(
                self._project_scope(actor),
                Project.status.in_((ProjectStatus.PLANNING, ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD)),
            )
            .order_by(Project.end_date.asc().nullslast(), Project.updated_at.desc())
            .limit(limit)
        ))

    def customers(self, actor: User, limit: int = 4) -> tuple[list[Customer], list[Customer], list[Activity]]:
        """Return management-only customer additions, updates, and activity."""
        if actor.role == UserRole.EMPLOYEE:
            return [], [], []
        base = Customer.company_id == actor.company_id, Customer.deleted_at.is_(None)
        added = list(self._session.scalars(select(Customer).where(*base).order_by(Customer.created_at.desc()).limit(limit)))
        updated = list(self._session.scalars(
            select(Customer).where(*base, Customer.updated_at > Customer.created_at).order_by(Customer.updated_at.desc()).limit(limit)
        ))
        activity = list(self._session.scalars(
            select(Activity).where(Activity.company_id == actor.company_id, Activity.entity_type == "customer").order_by(Activity.created_at.desc()).limit(3)
        ))
        return added, updated, activity

    def employees(self, actor: User, limit: int = 4) -> tuple[list[User], list[User], list[Activity]]:
        """Return visible employee updates, workload leaders, and authorized activity."""
        scope = self._employee_scope(actor)
        eager = (selectinload(User.assigned_tasks), selectinload(User.owned_projects))
        updated = list(self._session.scalars(select(User).options(*eager).where(scope).order_by(User.updated_at.desc()).limit(limit)).unique())
        workload = list(self._session.scalars(
            select(User)
            .options(*eager)
            .outerjoin(Task, and_(Task.assignee_id == User.id, Task.deleted_at.is_(None), Task.status != TaskStatus.DONE))
            .where(scope)
            .group_by(User.id)
            .order_by(func.count(Task.id).desc(), User.last_name, User.first_name)
            .limit(limit)
        ).unique())
        activity: list[Activity] = []
        if actor.role != UserRole.EMPLOYEE:
            activity = list(self._session.scalars(
                select(Activity).where(Activity.company_id == actor.company_id, Activity.entity_type == "user").order_by(Activity.created_at.desc()).limit(3)
            ))
        return updated, workload, activity

    def recent_activity(self, actor: User, limit: int = 6) -> list[Activity]:
        """Return management-authorized activity facts for the AI brief."""
        if actor.role == UserRole.EMPLOYEE:
            return []
        return list(self._session.scalars(
            select(Activity).where(Activity.company_id == actor.company_id).order_by(Activity.created_at.desc()).limit(limit)
        ))
