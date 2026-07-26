"""Invitation persistence operations."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models.invitation import Invitation


class InvitationRepository:
    """Encapsulates invitation lookup and persistence."""

    def __init__(self, session: Session) -> None:
        """Create a repository bound to one unit-of-work session."""
        self._session = session

    def get_by_token_hash(self, token_hash: str) -> Invitation | None:
        """Lock and return an invitation so acceptance remains one-time under concurrency."""
        return self._session.scalar(select(Invitation).where(Invitation.token_hash == token_hash).with_for_update())

    def add(self, invitation: Invitation) -> None:
        """Stage an invitation for persistence."""
        self._session.add(invitation)
