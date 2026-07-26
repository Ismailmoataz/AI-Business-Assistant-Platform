"""Token persistence operations for revocation and one-time flows."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.database.models.password_reset_token import PasswordResetToken
from app.database.models.refresh_token import RefreshToken


class TokenRepository:
    """Encapsulates refresh and reset token storage."""

    def __init__(self, session: Session) -> None:
        """Create a repository bound to one unit-of-work session."""
        self._session = session

    def get_refresh_token(self, token_hash: str) -> RefreshToken | None:
        """Lock and return a refresh token so rotation cannot race."""
        return self._session.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash).with_for_update())

    def add_refresh_token(self, token: RefreshToken) -> None:
        """Stage a refresh-token record for persistence."""
        self._session.add(token)

    def revoke_user_refresh_tokens(self, user_id: UUID) -> None:
        """Revoke every active refresh token for a user."""
        self._session.execute(update(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False)).values(revoked=True))

    def get_password_reset(self, token_hash: str) -> PasswordResetToken | None:
        """Return a password-reset record by its hashed opaque token."""
        return self._session.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash))

    def add_password_reset(self, token: PasswordResetToken) -> None:
        """Stage a password-reset record for persistence."""
        self._session.add(token)

    def expire_user_password_resets(self, user_id: UUID) -> None:
        """Mark all outstanding reset tokens as consumed."""
        self._session.execute(update(PasswordResetToken).where(PasswordResetToken.user_id == user_id, PasswordResetToken.used_at.is_(None)).values(used_at=datetime.now(UTC)))
