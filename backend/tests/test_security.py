"""Unit tests for password and JWT security primitives."""

from datetime import timedelta
from uuid import uuid4

import pytest

from app.core.security import create_token, decode_token, hash_password, verify_password
from app.database.models.enums import UserRole


def test_password_hash_is_not_plaintext_and_verifies() -> None:
    """Argon2 hashes must verify only the original password."""
    password_hash = hash_password("Correct-Horse-7-Battery!")

    assert password_hash != "Correct-Horse-7-Battery!"
    assert verify_password("Correct-Horse-7-Battery!", password_hash)
    assert not verify_password("wrong-password", password_hash)


def test_access_token_rejects_as_refresh_token() -> None:
    """JWT type claims prevent a bearer access token from being reused as refresh."""
    token, _, _ = create_token(user_id=uuid4(), company_id=uuid4(), role=UserRole.ADMIN, token_type="access", expires_delta=timedelta(minutes=1))

    assert decode_token(token, "access")["type"] == "access"
    with pytest.raises(ValueError):
        decode_token(token, "refresh")
