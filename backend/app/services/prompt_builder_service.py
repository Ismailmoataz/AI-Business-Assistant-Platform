"""Configurable assembly of tenant-safe prompts for chat providers."""

from collections.abc import Sequence

from app.config.settings import Settings, settings
from app.database.models.company import Company
from app.database.models.user import User


class PromptBuilderService:
    """Builds provider-neutral message lists without calling any model."""

    def __init__(self, config: Settings = settings) -> None:
        """Create the builder from the configured system-prompt template."""
        self._system_prompt = config.ai_system_prompt

    def build(self, company: Company, user: User, context: str, history: Sequence[dict[str, str]], user_message: str) -> list[dict[str, str]]:
        """Combine configured policy, tenant identity, context, history, and user input."""
        system = "\n".join(part for part in (self._system_prompt.strip(), f"Company: {company.name}", f"User role: {user.role}", "Use only the supplied context and say when it is insufficient.") if part)
        messages = [{"role": "system", "content": system}]
        messages.extend({"role": item["role"], "content": item["content"]} for item in history if item.get("role") in {"system", "user", "assistant"} and item.get("content"))
        messages.append({"role": "user", "content": f"Retrieved context:\n{context or '(none)'}\n\nQuestion: {user_message}"})
        return messages
