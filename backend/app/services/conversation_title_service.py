"""Pure title derivation for first-message conversation labels."""

import re


class ConversationTitleService:
    """Creates short, deterministic titles without persistence or provider calls."""

    def generate(self, first_user_message: str) -> str:
        """Return a normalized title containing up to eight meaningful words."""
        words = re.findall(r"[\w'-]+", first_user_message.strip())
        if not words:
            return "New conversation"
        selected = words[:8]
        if len(selected) < 3:
            selected.extend(["conversation"] * (3 - len(selected)))
        return " ".join(selected).capitalize()
