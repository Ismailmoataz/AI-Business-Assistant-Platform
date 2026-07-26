"""Align document processing lifecycle values with the background workflow.

Revision ID: 20260720_0007
Revises: 20260720_0006
"""

import sqlalchemy as sa
from alembic import op

revision = "20260720_0007"
down_revision = "20260720_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Migrate existing lifecycle values and enforce the new state names."""
    op.drop_constraint("ck_documents_processing_status", "documents", type_="check")
    op.execute("UPDATE documents SET processing_status = 'uploaded' WHERE processing_status = 'pending'")
    op.execute("UPDATE documents SET processing_status = 'ready' WHERE processing_status = 'completed'")
    op.alter_column("documents", "processing_status", existing_type=sa.String(length=20), server_default="uploaded", nullable=False)
    op.create_check_constraint("ck_documents_processing_status", "documents", "processing_status IN ('uploaded', 'processing', 'ready', 'failed')")


def downgrade() -> None:
    """Restore the original lifecycle values and constraint."""
    op.drop_constraint("ck_documents_processing_status", "documents", type_="check")
    op.execute("UPDATE documents SET processing_status = 'pending' WHERE processing_status = 'uploaded'")
    op.execute("UPDATE documents SET processing_status = 'completed' WHERE processing_status = 'ready'")
    op.alter_column("documents", "processing_status", existing_type=sa.String(length=20), server_default="pending", nullable=False)
    op.create_check_constraint("ck_documents_processing_status", "documents", "processing_status IN ('pending', 'processing', 'completed', 'failed')")
