"""Create conversation and message database foundation.

Revision ID: 20260720_0006
Revises: 20260720_0005
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260720_0006"
down_revision = "20260720_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create tenant conversations and cascade-deleted message history."""
    uid = postgresql.UUID(as_uuid=True)
    op.create_table("conversations", sa.Column("id", uid, primary_key=True), sa.Column("company_id", uid, nullable=False), sa.Column("owner_id", uid, nullable=False), sa.Column("title", sa.String(250)), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"), sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"))
    op.create_index("ix_conversations_company_id", "conversations", ["company_id"]); op.create_index("ix_conversations_owner_id", "conversations", ["owner_id"])
    op.create_table("messages", sa.Column("id", uid, primary_key=True), sa.Column("conversation_id", uid, nullable=False), sa.Column("role", sa.String(20), nullable=False), sa.Column("content", sa.Text(), nullable=False), sa.Column("metadata", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.CheckConstraint("role IN ('system', 'user', 'assistant')", name="ck_messages_role"), sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"))
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])


def downgrade() -> None:
    """Remove conversation tables in dependency order."""
    op.drop_table("messages"); op.drop_table("conversations")
