"""Tenant-scoped folder, document, version, and access-history models."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Column, Enum, ForeignKey, Index, Integer, String, Table, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.models.base import Base, SoftDeleteMixin, TimestampMixin
from app.database.models.business import enum_values
from app.database.models.enums import DocumentStatus, DocumentVisibility

if TYPE_CHECKING:
    from app.database.models.embeddings import DocumentChunk
    from app.database.models.business import Customer, Tag
    from app.database.models.company import Company
    from app.database.models.department import Department
    from app.database.models.user import User


document_tags = Table(
    "document_tags", Base.metadata,
    Column("document_id", ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Folder(SoftDeleteMixin, TimestampMixin, Base):
    """A nested company knowledge folder with a visibility scope."""

    __tablename__ = "folders"
    __table_args__ = (UniqueConstraint("company_id", "parent_id", "name", name="uq_folders_company_parent_name"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("folders.id", ondelete="CASCADE"), index=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False)
    department_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"), index=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    visibility: Mapped[DocumentVisibility] = mapped_column(Enum(DocumentVisibility, name="document_visibility", values_callable=enum_values), default=DocumentVisibility.PRIVATE, nullable=False)
    company: Mapped["Company"] = relationship()
    owner: Mapped["User"] = relationship()
    department: Mapped["Department | None"] = relationship()
    parent: Mapped["Folder | None"] = relationship(remote_side="Folder.id", back_populates="children")
    children: Mapped[list["Folder"]] = relationship(back_populates="parent")
    documents: Mapped[list["Document"]] = relationship(back_populates="folder")


class Document(SoftDeleteMixin, TimestampMixin, Base):
    """Current metadata and searchable text for a versioned stored file."""

    __tablename__ = "documents"
    __table_args__ = (
        Index(
            "ix_documents_company_active_processing_updated",
            "company_id",
            "processing_status",
            "updated_at",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), index=True)
    folder_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("folders.id", ondelete="SET NULL"), index=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False)
    department_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"), index=True)
    title: Mapped[str] = mapped_column(String(250), index=True, nullable=False)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(150), index=True, nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    visibility: Mapped[DocumentVisibility] = mapped_column(Enum(DocumentVisibility, name="document_visibility", values_callable=enum_values), default=DocumentVisibility.PRIVATE, nullable=False)
    status: Mapped[DocumentStatus] = mapped_column(Enum(DocumentStatus, name="document_status", values_callable=enum_values), default=DocumentStatus.ACTIVE, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    extracted_text: Mapped[str | None] = mapped_column(Text)
    object_key: Mapped[str] = mapped_column(String(1024), unique=True, nullable=False)
    processing_status: Mapped[str] = mapped_column(String(20), default="uploaded", nullable=False, index=True)
    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    company: Mapped["Company"] = relationship()
    customer: Mapped["Customer | None"] = relationship(back_populates="documents")
    folder: Mapped["Folder | None"] = relationship(back_populates="documents")
    owner: Mapped["User"] = relationship()
    department: Mapped["Department | None"] = relationship()
    versions: Mapped[list["DocumentVersion"]] = relationship(back_populates="document", cascade="all, delete-orphan", order_by="DocumentVersion.version")
    tags: Mapped[list["Tag"]] = relationship(secondary=document_tags)
    favorites: Mapped[list["DocumentFavorite"]] = relationship(back_populates="document", cascade="all, delete-orphan")
    chunks: Mapped[list["DocumentChunk"]] = relationship(back_populates="document", cascade="all, delete-orphan")


class DocumentVersion(TimestampMixin, Base):
    """Immutable metadata and storage key for one document revision."""

    __tablename__ = "document_versions"
    __table_args__ = (UniqueConstraint("document_id", "version", name="uq_document_versions_document_version"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True, nullable=False)
    uploaded_by_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(150), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    object_key: Mapped[str] = mapped_column(String(1024), unique=True, nullable=False)
    extracted_text: Mapped[str | None] = mapped_column(Text)
    document: Mapped["Document"] = relationship(back_populates="versions")
    uploaded_by: Mapped["User"] = relationship()
    chunks: Mapped[list["DocumentChunk"]] = relationship(back_populates="version", cascade="all, delete-orphan")


class DocumentFavorite(TimestampMixin, Base):
    """A user-specific bookmark for an accessible document."""

    __tablename__ = "document_favorites"
    __table_args__ = (UniqueConstraint("user_id", "document_id", name="uq_document_favorites_user_document"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True, nullable=False)
    document: Mapped["Document"] = relationship(back_populates="favorites")


class DocumentRecent(TimestampMixin, Base):
    """A per-user recently viewed document entry."""

    __tablename__ = "document_recents"
    __table_args__ = (UniqueConstraint("user_id", "document_id", name="uq_document_recents_user_document"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True, nullable=False)
    document: Mapped["Document"] = relationship()
