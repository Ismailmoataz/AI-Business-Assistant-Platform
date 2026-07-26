"""Create Phase 3 tenant knowledge and document storage metadata.

Revision ID: 20260719_0003
Revises: 20260719_0002
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260719_0003"
down_revision = "20260719_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create folders, document versions, user access history, and tag links."""
    bind = op.get_bind(); visibility = postgresql.ENUM("private", "department", "company", name="document_visibility", create_type=False); status = postgresql.ENUM("active", "archived", name="document_status", create_type=False)
    visibility.create(bind, checkfirst=True); status.create(bind, checkfirst=True); uid = postgresql.UUID(as_uuid=True)
    op.create_table("folders", sa.Column("id", uid, primary_key=True), sa.Column("company_id", uid, nullable=False), sa.Column("parent_id", uid), sa.Column("owner_id", uid, nullable=False), sa.Column("department_id", uid), sa.Column("name", sa.String(180), nullable=False), sa.Column("visibility", visibility, server_default="private", nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("deleted_at", sa.DateTime(timezone=True)), sa.ForeignKeyConstraint(["company_id"],["companies.id"],ondelete="CASCADE"), sa.ForeignKeyConstraint(["parent_id"],["folders.id"],ondelete="CASCADE"), sa.ForeignKeyConstraint(["owner_id"],["users.id"],ondelete="RESTRICT"), sa.ForeignKeyConstraint(["department_id"],["departments.id"],ondelete="SET NULL"), sa.UniqueConstraint("company_id","parent_id","name",name="uq_folders_company_parent_name"))
    for col in ("company_id","parent_id","owner_id","department_id","deleted_at"): op.create_index(f"ix_folders_{col}","folders",[col])
    op.create_table("documents", sa.Column("id",uid,primary_key=True),sa.Column("company_id",uid,nullable=False),sa.Column("folder_id",uid),sa.Column("owner_id",uid,nullable=False),sa.Column("department_id",uid),sa.Column("title",sa.String(250),nullable=False),sa.Column("filename",sa.String(512),nullable=False),sa.Column("mime_type",sa.String(150),nullable=False),sa.Column("size_bytes",sa.BigInteger,nullable=False),sa.Column("description",sa.Text),sa.Column("visibility",visibility,server_default="private",nullable=False),sa.Column("status",status,server_default="active",nullable=False),sa.Column("version",sa.Integer,server_default="1",nullable=False),sa.Column("extracted_text",sa.Text),sa.Column("object_key",sa.String(1024),nullable=False),sa.Column("created_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),sa.Column("updated_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),sa.Column("deleted_at",sa.DateTime(timezone=True)),sa.ForeignKeyConstraint(["company_id"],["companies.id"],ondelete="CASCADE"),sa.ForeignKeyConstraint(["folder_id"],["folders.id"],ondelete="SET NULL"),sa.ForeignKeyConstraint(["owner_id"],["users.id"],ondelete="RESTRICT"),sa.ForeignKeyConstraint(["department_id"],["departments.id"],ondelete="SET NULL"),sa.UniqueConstraint("object_key"))
    for col in ("company_id","folder_id","owner_id","department_id","title","mime_type","deleted_at"): op.create_index(f"ix_documents_{col}","documents",[col])
    op.create_table("document_versions",sa.Column("id",uid,primary_key=True),sa.Column("document_id",uid,nullable=False),sa.Column("uploaded_by_user_id",uid,nullable=False),sa.Column("version",sa.Integer,nullable=False),sa.Column("filename",sa.String(512),nullable=False),sa.Column("mime_type",sa.String(150),nullable=False),sa.Column("size_bytes",sa.BigInteger,nullable=False),sa.Column("object_key",sa.String(1024),nullable=False),sa.Column("extracted_text",sa.Text),sa.Column("created_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),sa.Column("updated_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),sa.ForeignKeyConstraint(["document_id"],["documents.id"],ondelete="CASCADE"),sa.ForeignKeyConstraint(["uploaded_by_user_id"],["users.id"],ondelete="RESTRICT"),sa.UniqueConstraint("document_id","version",name="uq_document_versions_document_version"),sa.UniqueConstraint("object_key"))
    op.create_index("ix_document_versions_document_id","document_versions",["document_id"])
    for table in ("document_favorites","document_recents"):
        op.create_table(table,sa.Column("id",uid,primary_key=True),sa.Column("user_id",uid,nullable=False),sa.Column("document_id",uid,nullable=False),sa.Column("created_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),sa.Column("updated_at",sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),sa.ForeignKeyConstraint(["user_id"],["users.id"],ondelete="CASCADE"),sa.ForeignKeyConstraint(["document_id"],["documents.id"],ondelete="CASCADE"),sa.UniqueConstraint("user_id","document_id",name=f"uq_{table}_user_document")); op.create_index(f"ix_{table}_user_id",table,["user_id"]); op.create_index(f"ix_{table}_document_id",table,["document_id"])
    op.create_table("document_tags",sa.Column("document_id",uid,nullable=False),sa.Column("tag_id",uid,nullable=False),sa.ForeignKeyConstraint(["document_id"],["documents.id"],ondelete="CASCADE"),sa.ForeignKeyConstraint(["tag_id"],["tags.id"],ondelete="CASCADE"),sa.PrimaryKeyConstraint("document_id","tag_id"))


def downgrade() -> None:
    """Remove Phase 3 metadata in dependency order."""
    for table in ("document_tags","document_recents","document_favorites","document_versions","documents","folders"): op.drop_table(table)
    bind=op.get_bind(); postgresql.ENUM(name="document_status").drop(bind,checkfirst=True); postgresql.ENUM(name="document_visibility").drop(bind,checkfirst=True)
