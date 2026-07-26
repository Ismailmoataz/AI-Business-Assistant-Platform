"""Password and JWT primitives for the identity domain."""

from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe
from uuid import UUID, uuid4

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from jwt import InvalidTokenError

from app.config.settings import settings
from app.database.models.enums import UserRole

_password_hasher = (
    PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
    if settings.environment == "test"
    else PasswordHasher()
)


def hash_password(password: str) -> str:
    """Hash a plaintext password with Argon2."""
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a plaintext password against an Argon2 hash."""
    try:
        return _password_hasher.verify(password_hash, password)
    except (InvalidHashError, VerificationError):
        return False


def generate_opaque_token() -> str:
    """Create a high-entropy one-time token for resets or invitations."""
    return token_urlsafe(48)


def hash_token(token: str) -> str:
    """Return a non-reversible SHA-256 representation of an opaque token."""
    return sha256(token.encode("utf-8")).hexdigest()


def create_token(*, user_id: UUID, company_id: UUID, role: UserRole, token_type: str, expires_delta: timedelta) -> tuple[str, str, datetime]:
    """Create a signed JWT, its identifier, and its expiration timestamp."""
    now = datetime.now(UTC)
    expires_at = now + expires_delta
    token_id = str(uuid4())
    payload = {"sub": str(user_id), "company_id": str(company_id), "role": role.value, "type": token_type, "jti": token_id, "iat": now, "exp": expires_at, "iss": settings.jwt_issuer, "aud": settings.jwt_audience}
    token = jwt.encode(payload, settings.jwt_secret_key.get_secret_value(), algorithm=settings.jwt_algorithm)
    return token, token_id, expires_at


def decode_token(token: str, expected_type: str) -> dict[str, str]:
    """Verify a JWT and return its claims only when its type is expected."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key.get_secret_value(), algorithms=[settings.jwt_algorithm], audience=settings.jwt_audience, issuer=settings.jwt_issuer, options={"require": ["exp", "iat", "sub", "jti", "type"]})
    except InvalidTokenError as exc:
        raise ValueError("Invalid or expired token") from exc
    if payload.get("type") != expected_type:
        raise ValueError("Unexpected token type")
    return {key: str(value) for key, value in payload.items()}
