"""Add document ingestion processing lifecycle fields.

Revision ID: 20260720_0005
Revises: 20260719_0004
"""

import sqlalchemy as sa
from alembic import op

revision = "20260720_0005"
down_revision = "20260719_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add non-destructive processing status and error metadata."""
    op.add_column("documents", sa.Column("processing_status", sa.String(length=20), server_default="pending", nullable=False))
    op.add_column("documents", sa.Column("processing_error", sa.Text(), nullable=True))
    op.create_check_constraint("ck_documents_processing_status", "documents", "processing_status IN ('pending', 'processing', 'completed', 'failed')")
    op.create_index("ix_documents_processing_status", "documents", ["processing_status"])


def downgrade() -> None:
    """Remove document processing lifecycle fields."""
    op.drop_index("ix_documents_processing_status", table_name="documents")
    op.drop_constraint("ck_documents_processing_status", "documents", type_="check")
    op.drop_column("documents", "processing_error")
    op.drop_column("documents", "processing_status")
