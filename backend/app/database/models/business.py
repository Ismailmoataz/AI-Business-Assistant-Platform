"""Company-scoped business-domain models and tag associations."""

from __future__ import annotations

import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Column, Date, Enum, ForeignKey, Index, Integer, String, Table, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.models.base import Base, SoftDeleteMixin, TimestampMixin
from app.database.models.enums import (
    ActivityAction,
    CustomerStatus,
    CustomerType,
    NoteScope,
    ProjectStatus,
    TaskPriority,
    TaskStatus,
)

if TYPE_CHECKING:
    from app.database.models.company import Company
    from app.database.models.department import Department
    from app.database.models.documents import Document
    from app.database.models.user import User


def enum_values(values: type) -> list[str]:
    """Persist StrEnum values instead of Python enum member names."""
    return [member.value for member in values]  # type: ignore[union-attr]


customer_tags = Table(
    "customer_tags",
    Base.metadata,
    Column("customer_id", ForeignKey("customers.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

project_tags = Table(
    "project_tags",
    Base.metadata,
    Column("project_id", ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

task_tags = Table(
    "task_tags",
    Base.metadata,
    Column("task_id", ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

note_tags = Table(
    "note_tags",
    Base.metadata,
    Column("note_id", ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Customer(SoftDeleteMixin, TimestampMixin, Base):
    """A company or individual customer belonging to one tenant."""

    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint("company_id", "name", name="uq_customers_company_name"),
        Index(
            "ix_customers_company_active_updated",
            "company_id",
            "updated_at",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    customer_type: Mapped[CustomerType] = mapped_column(Enum(CustomerType, name="customer_type", values_callable=enum_values), nullable=False)
    status: Mapped[CustomerStatus] = mapped_column(Enum(CustomerStatus, name="customer_status", values_callable=enum_values), default=CustomerStatus.PROSPECT, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), index=True)
    phone: Mapped[str | None] = mapped_column(String(50))
    contact_name: Mapped[str | None] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(Text)
    company: Mapped["Company"] = relationship(back_populates="customers")
    tags: Mapped[list["Tag"]] = relationship(secondary=customer_tags, back_populates="customers")
    projects: Mapped[list["Project"]] = relationship(back_populates="customer")
    documents: Mapped[list["Document"]] = relationship(back_populates="customer")
    linked_notes: Mapped[list["Note"]] = relationship(back_populates="customer")


class Project(SoftDeleteMixin, TimestampMixin, Base):
    """A department-owned project with a responsible employee."""

    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint("end_date IS NULL OR start_date IS NULL OR end_date >= start_date", name="ck_projects_dates"),
        Index(
            "ix_projects_company_active_status_updated",
            "company_id",
            "status",
            "updated_at",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), index=True)
    department_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"), index=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus, name="project_status", values_callable=enum_values), default=ProjectStatus.PLANNING, nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    company: Mapped["Company"] = relationship(back_populates="projects")
    customer: Mapped["Customer | None"] = relationship(back_populates="projects")
    department: Mapped["Department | None"] = relationship(back_populates="projects")
    owner: Mapped["User"] = relationship(back_populates="owned_projects", foreign_keys=[owner_id])
    tasks: Mapped[list["Task"]] = relationship(back_populates="project")
    tags: Mapped[list["Tag"]] = relationship(secondary=project_tags, back_populates="projects")
    notes: Mapped[list["Note"]] = relationship(back_populates="project")


class Task(SoftDeleteMixin, TimestampMixin, Base):
    """An actionable project work item assigned to at most one employee."""

    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("progress >= 0 AND progress <= 100", name="ck_tasks_progress"),
        Index(
            "ix_tasks_company_active_assignee_status_due",
            "company_id",
            "assignee_id",
            "status",
            "due_date",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus, name="task_status", values_callable=enum_values), default=TaskStatus.TODO, nullable=False)
    priority: Mapped[TaskPriority] = mapped_column(Enum(TaskPriority, name="task_priority", values_callable=enum_values), default=TaskPriority.MEDIUM, nullable=False)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, index=True)
    company: Mapped["Company"] = relationship(back_populates="tasks")
    project: Mapped["Project"] = relationship(back_populates="tasks")
    assignee: Mapped["User | None"] = relationship(back_populates="assigned_tasks", foreign_keys=[assignee_id])
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_user_id])
    comments: Mapped[list["TaskComment"]] = relationship(back_populates="task", cascade="all, delete-orphan", order_by="TaskComment.created_at")
    tags: Mapped[list["Tag"]] = relationship(secondary=task_tags, back_populates="tasks")
    notes: Mapped[list["Note"]] = relationship(back_populates="task")


class TaskComment(TimestampMixin, Base):
    """A non-editable discussion entry on a task."""

    __tablename__ = "task_comments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True, nullable=False)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    task: Mapped["Task"] = relationship(back_populates="comments")
    author: Mapped["User"] = relationship()


class Note(SoftDeleteMixin, TimestampMixin, Base):
    """A personal, company, or project note."""

    __tablename__ = "notes"
    __table_args__ = (
        Index(
            "ix_notes_company_active_owner_updated",
            "company_id",
            "owner_id",
            "updated_at",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False)
    employee_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), index=True)
    task_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"), index=True)
    document_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"), index=True)
    scope: Mapped[NoteScope] = mapped_column(Enum(NoteScope, name="note_scope", values_callable=enum_values), nullable=False)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    company: Mapped["Company"] = relationship(back_populates="notes")
    project: Mapped["Project | None"] = relationship(back_populates="notes")
    owner: Mapped["User"] = relationship(back_populates="notes", foreign_keys=[owner_id])
    employee: Mapped["User | None"] = relationship(foreign_keys=[employee_id])
    customer: Mapped["Customer | None"] = relationship(back_populates="linked_notes")
    task: Mapped["Task | None"] = relationship(back_populates="notes")
    document: Mapped["Document | None"] = relationship()
    tags: Mapped[list["Tag"]] = relationship(secondary=note_tags, back_populates="notes")


class Tag(SoftDeleteMixin, TimestampMixin, Base):
    """A tenant-scoped reusable classification label."""

    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("company_id", "name", name="uq_tags_company_name"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    color: Mapped[str | None] = mapped_column(String(7))
    company: Mapped["Company"] = relationship(back_populates="tags")
    customers: Mapped[list[Customer]] = relationship(secondary=customer_tags, back_populates="tags")
    projects: Mapped[list[Project]] = relationship(secondary=project_tags, back_populates="tags")
    tasks: Mapped[list[Task]] = relationship(secondary=task_tags, back_populates="tags")
    notes: Mapped[list[Note]] = relationship(secondary=note_tags, back_populates="tags")

    @property
    def customer_count(self) -> int:
        """Count active customers currently using this tag."""
        return sum(customer.deleted_at is None for customer in self.customers)

    @property
    def project_count(self) -> int:
        """Count active projects currently using this tag."""
        return sum(project.deleted_at is None for project in self.projects)

    @property
    def task_count(self) -> int:
        """Count active tasks currently using this tag."""
        return sum(task.deleted_at is None for task in self.tasks)

    @property
    def note_count(self) -> int:
        """Count active notes currently using this tag."""
        return sum(note.deleted_at is None for note in self.notes)


class Activity(TimestampMixin, Base):
    """Immutable audit event for a company-scoped business record."""

    __tablename__ = "activities"
    __table_args__ = (
        Index(
            "ix_activities_company_entity_created",
            "company_id",
            "entity_type",
            "entity_id",
            "created_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action: Mapped[ActivityAction] = mapped_column(Enum(ActivityAction, name="activity_action", values_callable=enum_values), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)
    summary: Mapped[str] = mapped_column(String(500), nullable=False)
    company: Mapped["Company"] = relationship(back_populates="activities")
    actor: Mapped["User | None"] = relationship()
