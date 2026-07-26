"""Tenant-safe persistence operations for conversations and their messages."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database.models.conversations import Conversation, Message


class ConversationRepository:
    """Encapsulates company-scoped conversation and chronological message access."""

    def __init__(self, session: Session) -> None:
        """Bind the repository to one SQLAlchemy unit-of-work session."""
        self._session = session

    def create_conversation(self, company_id: UUID, owner_id: UUID, title: str | None = None) -> Conversation:
        """Stage and return a conversation belonging to one company and owner."""
        conversation = Conversation(company_id=company_id, owner_id=owner_id, title=title)
        self._session.add(conversation)
        return conversation

    def get_conversation_by_id(self, conversation_id: UUID, company_id: UUID) -> Conversation | None:
        """Return a conversation only when it belongs to the requested tenant."""
        return self._session.scalar(select(Conversation).where(Conversation.id == conversation_id, Conversation.company_id == company_id))

    def list_company_conversations(self, company_id: UUID, offset: int, limit: int, owner_id: UUID | None = None, search: str | None = None) -> tuple[list[Conversation], int]:
        """Return a filtered tenant conversation page ordered by recent activity."""
        statement = select(Conversation).where(Conversation.company_id == company_id)
        if owner_id is not None:
            statement = statement.where(Conversation.owner_id == owner_id)
        if search:
            message_match = select(Message.id).where(
                Message.conversation_id == Conversation.id,
                Message.content.icontains(search, autoescape=True),
            ).exists()
            statement = statement.where(
                or_(Conversation.title.icontains(search, autoescape=True), message_match)
            )
        total = self._session.scalar(select(func.count()).select_from(statement.subquery())) or 0
        items = list(self._session.scalars(statement.order_by(Conversation.updated_at.desc(), Conversation.created_at.desc()).offset(offset).limit(limit)))
        return items, total

    def get_message_by_id(self, message_id: UUID, conversation_id: UUID, company_id: UUID) -> Message | None:
        """Return a message only through its tenant-owned conversation."""
        return self._session.scalar(
            select(Message)
            .join(Conversation)
            .where(
                Message.id == message_id,
                Message.conversation_id == conversation_id,
                Conversation.company_id == company_id,
            )
        )

    def get_last_message_previews(self, company_id: UUID, conversation_ids: list[UUID]) -> dict[UUID, str]:
        """Return one bounded latest-message preview per tenant-owned conversation."""
        if not conversation_ids:
            return {}
        ranked_messages = (
            select(
                Message.conversation_id.label("conversation_id"),
                Message.content.label("content"),
                func.row_number()
                .over(
                    partition_by=Message.conversation_id,
                    order_by=(Message.created_at.desc(), Message.id.desc()),
                )
                .label("row_number"),
            )
            .join(Conversation)
            .where(
                Conversation.company_id == company_id,
                Conversation.id.in_(conversation_ids),
            )
            .subquery()
        )
        rows = self._session.execute(
            select(ranked_messages.c.conversation_id, ranked_messages.c.content).where(
                ranked_messages.c.row_number == 1
            )
        )
        return {conversation_id: content.strip()[:180] for conversation_id, content in rows}

    def add_message(self, conversation: Conversation, role: str, content: str, metadata: dict | None = None) -> Message:
        """Stage a message in its existing tenant-validated conversation."""
        message = Message(
            conversation_id=conversation.id,
            role=role,
            content=content,
            metadata_=metadata or {},
            created_at=datetime.now(UTC),
        )
        self._session.add(message)
        return message

    def get_messages(self, conversation_id: UUID, company_id: UUID) -> list[Message]:
        """Return chronological messages only through a tenant-owned conversation."""
        return list(self._session.scalars(select(Message).join(Conversation).where(Message.conversation_id == conversation_id, Conversation.company_id == company_id).order_by(Message.created_at, Message.id)))

    def update_conversation_title(self, conversation_id: UUID, company_id: UUID, title: str | None) -> Conversation | None:
        """Update title only when the conversation belongs to the requested tenant."""
        conversation = self.get_conversation_by_id(conversation_id, company_id)
        if conversation is not None:
            conversation.title = title
        return conversation

    def delete_conversation(self, conversation_id: UUID, company_id: UUID) -> bool:
        """Delete one tenant-owned conversation and cascade-delete its messages."""
        conversation = self.get_conversation_by_id(conversation_id, company_id)
        if conversation is None:
            return False
        self._session.delete(conversation)
        return True
