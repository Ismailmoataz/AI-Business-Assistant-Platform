"""Unit tests for provider-neutral prompt assembly."""

from types import SimpleNamespace

from app.services.prompt_builder_service import PromptBuilderService


def test_prompt_builder_preserves_config_context_history_and_question() -> None:
    """Prompt assembly should retain tenant, history, retrieved context, and current input."""
    builder = PromptBuilderService(SimpleNamespace(ai_system_prompt="Configured policy"))
    messages = builder.build(SimpleNamespace(name="Acme"), SimpleNamespace(role="admin"), "Source context", [{"role": "assistant", "content": "Earlier answer"}], "Current question")
    assert "Configured policy" in messages[0]["content"]
    assert "Company: Acme" in messages[0]["content"]
    assert messages[1]["content"] == "Earlier answer"
    assert "Source context" in messages[-1]["content"]
    assert "Current question" in messages[-1]["content"]
