"""Add production query-path indexes.

Revision ID: 20260726_0010
Revises: 20260722_0009
"""

import sqlalchemy as sa
from alembic import op

revision = "20260726_0010"
down_revision = "20260722_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add composite indexes for tenant-scoped dashboards and collection reads."""
    active = sa.text("deleted_at IS NULL")
    op.create_index(
        "ix_users_company_employment_updated",
        "users",
        ["company_id", "employment_status", "updated_at"],
    )
    op.create_index(
        "ix_customers_company_active_updated",
        "customers",
        ["company_id", "updated_at"],
        postgresql_where=active,
    )
    op.create_index(
        "ix_projects_company_active_status_updated",
        "projects",
        ["company_id", "status", "updated_at"],
        postgresql_where=active,
    )
    op.create_index(
        "ix_tasks_company_active_assignee_status_due",
        "tasks",
        ["company_id", "assignee_id", "status", "due_date"],
        postgresql_where=active,
    )
    op.create_index(
        "ix_notes_company_active_owner_updated",
        "notes",
        ["company_id", "owner_id", "updated_at"],
        postgresql_where=active,
    )
    op.create_index(
        "ix_activities_company_entity_created",
        "activities",
        ["company_id", "entity_type", "entity_id", "created_at"],
    )
    op.create_index(
        "ix_documents_company_active_processing_updated",
        "documents",
        ["company_id", "processing_status", "updated_at"],
        postgresql_where=active,
    )
    op.create_index(
        "ix_conversations_company_owner_updated",
        "conversations",
        ["company_id", "owner_id", "updated_at"],
    )
    op.create_index(
        "ix_messages_conversation_created",
        "messages",
        ["conversation_id", "created_at"],
    )
    op.create_index(
        "ix_document_chunks_company_document_index",
        "document_chunks",
        ["company_id", "document_id", "chunk_index"],
    )


def downgrade() -> None:
    """Remove production query-path indexes."""
    op.drop_index("ix_document_chunks_company_document_index", table_name="document_chunks")
    op.drop_index("ix_messages_conversation_created", table_name="messages")
    op.drop_index("ix_conversations_company_owner_updated", table_name="conversations")
    op.drop_index("ix_documents_company_active_processing_updated", table_name="documents")
    op.drop_index("ix_activities_company_entity_created", table_name="activities")
    op.drop_index("ix_notes_company_active_owner_updated", table_name="notes")
    op.drop_index("ix_tasks_company_active_assignee_status_due", table_name="tasks")
    op.drop_index("ix_projects_company_active_status_updated", table_name="projects")
    op.drop_index("ix_customers_company_active_updated", table_name="customers")
    op.drop_index("ix_users_company_employment_updated", table_name="users")
