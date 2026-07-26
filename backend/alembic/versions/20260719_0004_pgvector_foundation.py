"""Create Phase 4.2A pgvector storage foundation.

Revision ID: 20260719_0004
Revises: 20260719_0003
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260719_0004"
down_revision = "20260719_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Enable pgvector and create tenant-scoped chunk and embedding tables."""
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    uuid_type = postgresql.UUID(as_uuid=True)
    op.create_table(
        "document_chunks",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("company_id", uuid_type, nullable=False),
        sa.Column("document_id", uuid_type, nullable=False),
        sa.Column("version_id", uuid_type, nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.Column("metadata", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["version_id"], ["document_versions.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("version_id", "chunk_index", name="uq_document_chunks_version_index"),
        sa.CheckConstraint("token_count >= 0", name="ck_document_chunks_token_count"),
    )
    op.create_index("ix_document_chunks_company_id", "document_chunks", ["company_id"])
    op.create_index("ix_document_chunks_document_id", "document_chunks", ["document_id"])
    op.create_index("ix_document_chunks_version_id", "document_chunks", ["version_id"])
    op.create_table(
        "document_embeddings",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("chunk_id", uuid_type, nullable=False),
        sa.Column("embedding", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(length=80), nullable=False),
        sa.Column("model", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["chunk_id"], ["document_chunks.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("chunk_id", "provider", "model", name="uq_document_embeddings_chunk_provider_model"),
    )
    op.create_index("ix_document_embeddings_chunk_id", "document_embeddings", ["chunk_id"])


def downgrade() -> None:
    """Remove the Phase 4.2A storage tables."""
    op.drop_table("document_embeddings")
    op.drop_table("document_chunks")
