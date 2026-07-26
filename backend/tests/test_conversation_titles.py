"""Unit tests for conversation title generation and fallback behavior."""

from app.repositories.conversation_repository import ConversationRepository
from app.schemas import RegisterRequest
from app.services.auth_service import AuthService
from app.services.conversation_service import ConversationService


class _TitleGenerator:
    """Deterministic successful title generator for service tests."""

    def generate(self, _message: str) -> str:
        """Return a configured generated title."""
        return "Generated project title"


class _FailingTitleGenerator:
    """Title generator that simulates provider failure."""

    def generate(self, _message: str) -> str:
        """Raise the configured title-generation failure."""
        raise RuntimeError("provider unavailable")


def _service(session, title_service):
    """Create a tenant user and title-aware conversation service."""
    _, user, _ = AuthService(session).register_company_admin(RegisterRequest(company_name="Acme", company_slug="acme", first_name="Ada", last_name="Admin", email="admin@example.com", password="Correct-Horse-7-Battery!"))
    return user, ConversationService(ConversationRepository(session), title_service)


def test_successful_title_generation(session) -> None:
    """A null title is set from the successful title generator once."""
    user, service = _service(session, _TitleGenerator())
    conversation = service.create_conversation(user)
    service.add_user_message(user, conversation.id, "First question")
    assert service.get_conversation(user, conversation.id).title == "Generated project title"


def test_fallback_title_on_provider_failure(session) -> None:
    """A failed generator falls back to trimmed first-message text."""
    user, service = _service(session, _FailingTitleGenerator())
    conversation = service.create_conversation(user)
    service.add_user_message(user, conversation.id, "  A sufficiently descriptive first user message for fallback  ")
    assert service.get_conversation(user, conversation.id).title == "A sufficiently descriptive first user message for fallback"[:50]


def test_existing_title_is_unchanged(session) -> None:
    """An explicit conversation title is never regenerated."""
    user, service = _service(session, _TitleGenerator())
    conversation = service.create_conversation(user, "Existing title")
    service.add_user_message(user, conversation.id, "First question")
    assert service.get_conversation(user, conversation.id).title == "Existing title"


def test_null_title_handling(session) -> None:
    """A newly created null title remains valid until its first user message."""
    user, service = _service(session, _TitleGenerator())
    conversation = service.create_conversation(user)
    assert service.get_conversation(user, conversation.id).title is None
