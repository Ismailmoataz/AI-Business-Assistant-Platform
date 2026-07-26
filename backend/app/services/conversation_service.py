"""Business workflows for tenant-safe conversation persistence."""

from datetime import UTC, datetime
from uuid import UUID

from app.database.models.conversations import Conversation, Message
from app.database.models.user import User
from app.repositories.conversation_repository import ConversationRepository
from app.services.conversation_title_service import ConversationTitleService


class ConversationNotFoundError(Exception):
    """Raised when a conversation is missing or inaccessible to the current owner."""


class ConversationMessageNotFoundError(Exception):
    """Raised when a requested message is absent from an owned conversation."""


class ConversationService:
    """Coordinates ownership checks and message lifecycle over conversation persistence."""

    def __init__(self, repository: ConversationRepository, title_service: ConversationTitleService | None = None) -> None:
        """Create the service from the request-scoped conversation repository."""
        self._repository = repository
        self._session = repository._session
        self._title_service = title_service or ConversationTitleService()

    def create_conversation(self, actor: User, title: str | None = None) -> Conversation:
        """Create and commit a company-owned conversation for the authenticated user."""
        conversation = self._repository.create_conversation(actor.company_id, actor.id, title.strip() if title else None)
        self._session.commit(); self._session.refresh(conversation)
        return conversation

    def get_conversation(self, actor: User, conversation_id: UUID) -> Conversation:
        """Return a conversation only to its owner within the authenticated tenant."""
        conversation = self._repository.get_conversation_by_id(conversation_id, actor.company_id)
        if conversation is None or conversation.owner_id != actor.id:
            raise ConversationNotFoundError("Conversation was not found")
        return conversation

    def list_conversations(self, actor: User, offset: int, limit: int, search: str | None = None) -> tuple[list[Conversation], int]:
        """Search and paginate only the caller's conversations."""
        normalized = search.strip() if search else None
        return self._repository.list_company_conversations(
            actor.company_id,
            offset,
            limit,
            owner_id=actor.id,
            search=normalized or None,
        )

    def get_last_message_previews(self, actor: User, conversations: list[Conversation]) -> dict[UUID, str]:
        """Return latest-message previews for an already owner-filtered conversation page."""
        return self._repository.get_last_message_previews(actor.company_id, [item.id for item in conversations])

    def _add_message(self, actor: User, conversation_id: UUID, role: str, content: str, metadata: dict | None = None) -> Message:
        """Add one validated message and update the conversation activity timestamp."""
        conversation = self.get_conversation(actor, conversation_id)
        message = self._repository.add_message(conversation, role, content, metadata)
        conversation.updated_at = datetime.now(UTC)
        self._session.commit(); self._session.refresh(message)
        return message

    def add_user_message(self, actor: User, conversation_id: UUID, content: str, metadata: dict | None = None) -> Message:
        """Persist a user-authored message in the caller's conversation."""
        message = self._add_message(actor, conversation_id, "user", content, metadata)
        conversation = self.get_conversation(actor, conversation_id)
        if conversation.title is None:
            try:
                conversation.title = self._title_service.generate(content)
                self._session.commit()
            except Exception:
                self._session.rollback()
                conversation.title = content.strip()[:50] or None
                self._session.commit()
        return message

    def add_assistant_message(self, actor: User, conversation_id: UUID, content: str, metadata: dict | None = None) -> Message:
        """Persist an assistant message in the caller's conversation."""
        return self._add_message(actor, conversation_id, "assistant", content, metadata)

    def get_conversation_history(self, actor: User, conversation_id: UUID) -> list[Message]:
        """Return chronological history only after ownership validation."""
        self.get_conversation(actor, conversation_id)
        return self._repository.get_messages(conversation_id, actor.company_id)

    def get_regeneration_prompt(self, actor: User, conversation_id: UUID, assistant_message_id: UUID) -> str:
        """Return the preserved user prompt immediately preceding an owned assistant message."""
        self.get_conversation(actor, conversation_id)
        target = self._repository.get_message_by_id(assistant_message_id, conversation_id, actor.company_id)
        if target is None or target.role != "assistant":
            raise ConversationMessageNotFoundError("Assistant message was not found")
        messages = self._repository.get_messages(conversation_id, actor.company_id)
        target_index = next((index for index, message in enumerate(messages) if message.id == target.id), -1)
        if target_index <= 0:
            raise ConversationMessageNotFoundError("The assistant message has no preceding user prompt")
        for message in reversed(messages[:target_index]):
            if message.role == "user":
                return message.content
        raise ConversationMessageNotFoundError("The assistant message has no preceding user prompt")

    def replace_assistant_message(self, actor: User, conversation_id: UUID, assistant_message_id: UUID, content: str, metadata: dict | None = None) -> Message:
        """Replace one owned assistant response in place after generation succeeds."""
        conversation = self.get_conversation(actor, conversation_id)
        target = self._repository.get_message_by_id(assistant_message_id, conversation_id, actor.company_id)
        if target is None or target.role != "assistant":
            raise ConversationMessageNotFoundError("Assistant message was not found")
        timestamp = datetime.now(UTC)
        target.content = content
        target.metadata_ = metadata or {}
        target.updated_at = timestamp
        conversation.updated_at = timestamp
        self._session.commit()
        self._session.refresh(target)
        return target

    def rename_conversation(self, actor: User, conversation_id: UUID, title: str | None) -> Conversation:
        """Rename an owned conversation and commit the title change."""
        self.get_conversation(actor, conversation_id)
        conversation = self._repository.update_conversation_title(conversation_id, actor.company_id, title.strip() if title else None)
        assert conversation is not None
        self._session.commit(); self._session.refresh(conversation)
        return conversation

    def delete_conversation(self, actor: User, conversation_id: UUID) -> None:
        """Delete an owned conversation and cascade-delete its messages."""
        self.get_conversation(actor, conversation_id)
        self._repository.delete_conversation(conversation_id, actor.company_id)
        self._session.commit()
