"""User identity model."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.models.base import Base, TimestampMixin
from app.database.models.enums import EmploymentStatus, UserRole

if TYPE_CHECKING:
    from app.database.models.business import Note, Project, Task
    from app.database.models.company import Company
    from app.database.models.department import Department
    from app.database.models.refresh_token import RefreshToken


class User(TimestampMixin, Base):
    """An authenticated person belonging to exactly one company."""

    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_company_employment_updated", "company_id", "employment_status", "updated_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), index=True, nullable=False)
    department_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"), index=True, nullable=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(
            UserRole,
            name="user_role",
            values_callable=lambda roles: [role.value for role in roles],
        ),
        default=UserRole.EMPLOYEE,
        nullable=False,
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    employment_status: Mapped[EmploymentStatus] = mapped_column(
        Enum(EmploymentStatus, name="employment_status", values_callable=lambda values: [value.value for value in values]),
        default=EmploymentStatus.ACTIVE,
        nullable=False,
    )
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(150), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    avatar_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    hire_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    manager_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)

    company: Mapped["Company"] = relationship(back_populates="users")
    department: Mapped["Department | None"] = relationship(back_populates="users")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    manager: Mapped["User | None"] = relationship(remote_side="User.id", back_populates="reports", foreign_keys=[manager_id])
    reports: Mapped[list["User"]] = relationship(back_populates="manager", foreign_keys=[manager_id])
    owned_projects: Mapped[list["Project"]] = relationship(back_populates="owner", foreign_keys="Project.owner_id")
    assigned_tasks: Mapped[list["Task"]] = relationship(back_populates="assignee", foreign_keys="Task.assignee_id")
    notes: Mapped[list["Note"]] = relationship(back_populates="owner", foreign_keys="Note.owner_id")

    @property
    def department_name(self) -> str | None:
        """Expose the department label without granting a separate directory permission."""
        return self.department.name if self.department else None

    @property
    def assigned_task_count(self) -> int:
        """Count active tasks currently assigned to this employee."""
        return sum(task.deleted_at is None for task in self.assigned_tasks)

    @property
    def assigned_project_count(self) -> int:
        """Count unique active projects owned by or assigning work to this employee."""
        project_ids = {project.id for project in self.owned_projects if project.deleted_at is None}
        project_ids.update(task.project_id for task in self.assigned_tasks if task.deleted_at is None)
        return len(project_ids)
