"""Add the review state to the task workflow.

Revision ID: 20260721_0008
Revises: 20260720_0007
Create Date: 2026-07-21
"""

from alembic import op

revision = "20260721_0008"
down_revision = "20260720_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add the review value without changing existing task states."""
    op.execute("ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'review' BEFORE 'done'")


def downgrade() -> None:
    """Map review work to in-progress and rebuild the original enum."""
    op.execute("ALTER TYPE task_status RENAME TO task_status_with_review")
    op.execute("CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'blocked', 'done')")
    op.execute("ALTER TABLE tasks ALTER COLUMN status DROP DEFAULT")
    op.execute(
        "ALTER TABLE tasks ALTER COLUMN status TYPE task_status "
        "USING (CASE WHEN status::text = 'review' THEN 'in_progress' ELSE status::text END)::task_status"
    )
    op.execute("ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'todo'")
    op.execute("DROP TYPE task_status_with_review")
