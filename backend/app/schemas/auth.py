"""Request and response contracts for identity workflows."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.config.settings import settings
from app.database.models.enums import UserRole


def normalize_email(value: str) -> str:
    """Normalize an email address before persistence or comparison."""
    return value.strip().lower()


def validate_password_strength(value: str) -> str:
    """Enforce the configurable password policy."""
    if len(value) < settings.password_min_length:
        raise ValueError(f"Password must be at least {settings.password_min_length} characters")
    if not any(character.islower() for character in value):
        raise ValueError("Password must contain a lowercase letter")
    if not any(character.isupper() for character in value):
        raise ValueError("Password must contain an uppercase letter")
    if not any(character.isdigit() for character in value):
        raise ValueError("Password must contain a number")
    if not any(not character.isalnum() for character in value):
        raise ValueError("Password must contain a symbol")
    return value


class RegisterRequest(BaseModel):
    """Payload used to create an initial company administrator."""

    company_name: str = Field(min_length=2, max_length=200)
    company_slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", min_length=2, max_length=80)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(max_length=128)

    @field_validator("company_name", "first_name", "last_name")
    @classmethod
    def reject_blank_names(cls, value: str) -> str:
        """Reject whitespace-only identity fields."""
        normalized = value.strip()
        if not normalized:
            raise ValueError("Field must not be blank")
        return normalized

    @field_validator("company_slug")
    @classmethod
    def normalize_slug(cls, value: str) -> str:
        """Normalize the tenant slug while preserving strict syntax validation."""
        return value.strip().lower()

    @field_validator("email")
    @classmethod
    def normalize_email_address(cls, value: EmailStr) -> str:
        """Normalize email addresses for stable uniqueness checks."""
        return normalize_email(str(value))

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        """Apply the configured password-strength policy."""
        return validate_password_strength(value)


class LoginRequest(BaseModel):
    """Payload used to authenticate with an email and password."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email_address(cls, value: EmailStr) -> str:
        """Normalize email addresses before authentication."""
        return normalize_email(str(value))


class RefreshRequest(BaseModel):
    """Payload used to rotate a refresh token."""

    refresh_token: str = Field(min_length=1)


class LogoutRequest(BaseModel):
    """Payload used to revoke a refresh token."""

    refresh_token: str = Field(min_length=1)


class PasswordResetRequest(BaseModel):
    """Payload used to request a password reset without disclosing account existence."""

    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email_address(cls, value: EmailStr) -> str:
        """Normalize the account email."""
        return normalize_email(str(value))


class PasswordResetConfirmRequest(BaseModel):
    """Payload used to complete a password reset with a one-time token."""

    token: str = Field(min_length=32)
    password: str = Field(max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        """Apply the configured password-strength policy."""
        return validate_password_strength(value)


class InvitationCreateRequest(BaseModel):
    """Payload used by an administrator to create an employee invitation."""

    email: EmailStr
    role: UserRole = UserRole.EMPLOYEE
    department_id: UUID | None = None

    @field_validator("email")
    @classmethod
    def normalize_email_address(cls, value: EmailStr) -> str:
        """Normalize the invitee email address."""
        return normalize_email(str(value))


class InvitationAcceptRequest(BaseModel):
    """Payload used by an invitee to create their account."""

    token: str = Field(min_length=32)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    password: str = Field(max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        """Apply the configured password-strength policy."""
        return validate_password_strength(value)


class CompanyResponse(BaseModel):
    """Public company representation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    active: bool
    created_at: datetime
    updated_at: datetime


class UserResponse(BaseModel):
    """Public representation of an authenticated user."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    department_id: UUID | None
    role: UserRole
    first_name: str
    last_name: str
    email: EmailStr
    active: bool
    email_verified: bool
    last_login: datetime | None
    created_at: datetime
    updated_at: datetime


class TokenPairResponse(BaseModel):
    """Access and refresh token pair returned after successful authentication."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    access_token_expires_in: int


class RegisterResponse(BaseModel):
    """Response returned after registering a company and its first administrator."""

    company: CompanyResponse
    user: UserResponse
    tokens: TokenPairResponse


class InvitationCreateResponse(BaseModel):
    """Invitation metadata and secure out-of-band delivery token."""

    invitation_id: UUID
    email: EmailStr
    expires_at: datetime
    invitation_token: str


class OperationMessageResponse(BaseModel):
    """Simple non-sensitive operation outcome."""

    message: str


class GoogleAuthorizationResponse(BaseModel):
    """Google authorization URL returned when OAuth is configured."""

    authorization_url: str
