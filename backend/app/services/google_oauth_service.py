"""Google OAuth authorization-start extension point."""

from secrets import token_urlsafe
from urllib.parse import urlencode

from redis import Redis

from app.config.settings import settings


class GoogleOAuthConfigurationError(Exception):
    """Raised when Google OAuth credentials are not configured."""


class GoogleOAuthService:
    """Builds a CSRF-protected Google authorization URL when configured."""

    def __init__(self, redis_client: Redis) -> None:
        """Create the service with the state store used for CSRF protection."""
        self._redis = redis_client

    def create_authorization_url(self) -> str:
        """Persist a short-lived state value and return Google's authorization URL."""
        if not all((settings.google_client_id, settings.google_client_secret, settings.google_redirect_uri)):
            raise GoogleOAuthConfigurationError("Google OAuth is not configured")
        state = token_urlsafe(32)
        self._redis.setex(f"google-oauth-state:{state}", 600, "1")
        query = urlencode({
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
        })
        return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"
