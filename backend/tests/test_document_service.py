"""Authorization and pagination regressions for document queries."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy.orm import Session

from app.database.models.company import Company
from app.database.models.documents import Document
from app.database.models.enums import DocumentVisibility, UserRole
from app.database.models.user import User
from app.services.document_service import DocumentService


def test_document_pagination_filters_visibility_before_limit(session: Session) -> None:
    """Hidden rows must not consume a page slot or distort the visible total."""
    company = Company(name="Acme", slug=f"acme-{uuid4().hex}")
    actor = User(company=company, role=UserRole.EMPLOYEE, first_name="Eve", last_name="Employee", email=f"{uuid4().hex}@example.com", password_hash="hash")
    other = User(company=company, role=UserRole.EMPLOYEE, first_name="Other", last_name="Owner", email=f"{uuid4().hex}@example.com", password_hash="hash")
    session.add_all([company, actor, other])
    session.flush()
    now = datetime.now(UTC)
    visible = Document(company_id=company.id, owner_id=other.id, title="Visible", filename="visible.txt", mime_type="text/plain", size_bytes=1, visibility=DocumentVisibility.COMPANY, object_key=f"{company.id}/visible", updated_at=now)
    hidden = Document(company_id=company.id, owner_id=other.id, title="Hidden", filename="hidden.txt", mime_type="text/plain", size_bytes=1, visibility=DocumentVisibility.PRIVATE, object_key=f"{company.id}/hidden", updated_at=now + timedelta(minutes=1))
    session.add_all([visible, hidden])
    session.commit()

    items, total = DocumentService(session, storage=object()).list_documents(actor, 0, 1, None, None)

    assert [item.id for item in items] == [visible.id]
    assert total == 1
