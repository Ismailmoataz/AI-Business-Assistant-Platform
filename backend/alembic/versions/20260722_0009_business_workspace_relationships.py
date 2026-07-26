"""Add customer and note relationships for the complete business workspace.

Revision ID: 20260722_0009
Revises: 20260721_0008
Create Date: 2026-07-22
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260722_0009"
down_revision = "20260721_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add nullable entity links and reusable note tags without rewriting data."""
    uid = postgresql.UUID(as_uuid=True)

    op.add_column("projects", sa.Column("customer_id", uid, nullable=True))
    op.create_foreign_key("fk_projects_customer_id", "projects", "customers", ["customer_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_projects_customer_id", "projects", ["customer_id"])

    op.add_column("documents", sa.Column("customer_id", uid, nullable=True))
    op.create_foreign_key("fk_documents_customer_id", "documents", "customers", ["customer_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_documents_customer_id", "documents", ["customer_id"])

    for column, target, ondelete in (
        ("employee_id", "users", "SET NULL"),
        ("customer_id", "customers", "SET NULL"),
        ("task_id", "tasks", "SET NULL"),
        ("document_id", "documents", "SET NULL"),
    ):
        op.add_column("notes", sa.Column(column, uid, nullable=True))
        op.create_foreign_key(f"fk_notes_{column}", "notes", target, [column], ["id"], ondelete=ondelete)
        op.create_index(f"ix_notes_{column}", "notes", [column])

    op.create_table(
        "note_tags",
        sa.Column("note_id", uid, nullable=False),
        sa.Column("tag_id", uid, nullable=False),
        sa.ForeignKeyConstraint(["note_id"], ["notes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("note_id", "tag_id"),
    )


def downgrade() -> None:
    """Remove the additive relationships in dependency-safe order."""
    op.drop_table("note_tags")
    for column in ("document_id", "task_id", "customer_id", "employee_id"):
        op.drop_index(f"ix_notes_{column}", table_name="notes")
        op.drop_constraint(f"fk_notes_{column}", "notes", type_="foreignkey")
        op.drop_column("notes", column)

    op.drop_index("ix_documents_customer_id", table_name="documents")
    op.drop_constraint("fk_documents_customer_id", "documents", type_="foreignkey")
    op.drop_column("documents", "customer_id")

    op.drop_index("ix_projects_customer_id", table_name="projects")
    op.drop_constraint("fk_projects_customer_id", "projects", type_="foreignkey")
    op.drop_column("projects", "customer_id")
