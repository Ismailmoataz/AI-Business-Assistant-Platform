"""Company tenant model."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.database.models.business import Activity, Customer, Note, Project, Tag, Task
    from app.database.models.department import Department
    from app.database.models.invitation import Invitation
    from app.database.models.user import User


class Company(TimestampMixin, Base):
    """A tenant that owns users, departments, and invitations."""

    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)

    departments: Mapped[list["Department"]] = relationship(back_populates="company", cascade="all, delete-orphan")
    users: Mapped[list["User"]] = relationship(back_populates="company")
    invitations: Mapped[list["Invitation"]] = relationship(back_populates="company", cascade="all, delete-orphan")
    customers: Mapped[list["Customer"]] = relationship(back_populates="company")
    projects: Mapped[list["Project"]] = relationship(back_populates="company")
    tasks: Mapped[list["Task"]] = relationship(back_populates="company")
    notes: Mapped[list["Note"]] = relationship(back_populates="company")
    tags: Mapped[list["Tag"]] = relationship(back_populates="company")
    activities: Mapped[list["Activity"]] = relationship(back_populates="company")
