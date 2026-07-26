"""Transactional authentication, password-reset, and invitation workflows."""

from datetime import UTC, datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.core.security import create_token, decode_token, generate_opaque_token, hash_password, hash_token, verify_password
from app.database.models.company import Company
from app.database.models.enums import UserRole
from app.database.models.invitation import Invitation
from app.database.models.password_reset_token import PasswordResetToken
from app.database.models.refresh_token import RefreshToken
from app.database.models.user import User
from app.repositories.company_repository import CompanyRepository
from app.repositories.department_repository import DepartmentRepository
from app.repositories.invitation_repository import InvitationRepository
from app.repositories.token_repository import TokenRepository
from app.repositories.user_repository import UserRepository
from app.schemas import InvitationAcceptRequest, InvitationCreateRequest, LoginRequest, RegisterRequest, TokenPairResponse


class DomainConflictError(Exception):
    """Raised when a unique business identity already exists."""


class AuthenticationError(Exception):
    """Raised when credentials or tokens cannot authenticate a user."""


class TokenValidationError(Exception):
    """Raised when a one-time or refresh token is invalid for its operation."""


def _is_expired(expires_at: datetime) -> bool:
    """Compare a database timestamp against UTC, including SQLite test values."""
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    return expires_at <= datetime.now(UTC)


class AuthService:
    """Coordinates identity operations within a single database session."""

    def __init__(self, session: Session) -> None:
        """Create the service and its session-bound repositories."""
        self._session = session
        self._companies = CompanyRepository(session)
        self._departments = DepartmentRepository(session)
        self._users = UserRepository(session)
        self._tokens = TokenRepository(session)
        self._invitations = InvitationRepository(session)

    def register_company_admin(self, payload: RegisterRequest) -> tuple[Company, User, TokenPairResponse]:
        """Create a company and its sole initial administrator atomically."""
        if self._companies.get_by_slug(payload.company_slug):
            raise DomainConflictError("Company slug is already in use")
        if self._users.get_by_email(payload.email):
            raise DomainConflictError("Email address is already in use")
        company = Company(name=payload.company_name.strip(), slug=payload.company_slug)
        user = User(company=company, role=UserRole.ADMIN, first_name=payload.first_name.strip(), last_name=payload.last_name.strip(), email=payload.email, password_hash=hash_password(payload.password))
        self._companies.add(company)
        self._users.add(user)
        try:
            self._session.flush()
            tokens = self._issue_token_pair(user)
            self._session.commit()
        except IntegrityError as exc:
            self._session.rollback()
            raise DomainConflictError("Company slug or email address is already in use") from exc
        return company, user, tokens

    def login(self, payload: LoginRequest) -> TokenPairResponse:
        """Authenticate an active local user and issue a new token pair."""
        user = self._users.get_by_email(payload.email)
        if user is None or not user.active or not user.company.active or not verify_password(payload.password, user.password_hash):
            raise AuthenticationError("Invalid email or password")
        user.last_login = datetime.now(UTC)
        tokens = self._issue_token_pair(user)
        self._session.commit()
        return tokens

    def refresh(self, refresh_token: str) -> TokenPairResponse:
        """Rotate a valid persisted refresh token into a new token pair."""
        claims = self._decode(refresh_token, "refresh")
        record = self._tokens.get_refresh_token(hash_token(claims["jti"]))
        if record is None or record.revoked or _is_expired(record.expires_at) or not record.user.active:
            raise AuthenticationError("Invalid or expired refresh token")
        record.revoked = True
        tokens = self._issue_token_pair(record.user)
        self._session.commit()
        return tokens

    def logout(self, refresh_token: str) -> None:
        """Revoke one refresh token so it cannot be used again."""
        claims = self._decode(refresh_token, "refresh")
        record = self._tokens.get_refresh_token(hash_token(claims["jti"]))
        if record is not None:
            record.revoked = True
            self._session.commit()

    def request_password_reset(self, email: str) -> str | None:
        """Create a reset token for delivery by a future email integration."""
        user = self._users.get_by_email(email)
        if user is None or not user.active:
            return None
        raw_token = generate_opaque_token()
        self._tokens.expire_user_password_resets(user.id)
        self._tokens.add_password_reset(PasswordResetToken(user_id=user.id, token_hash=hash_token(raw_token), expires_at=datetime.now(UTC) + timedelta(minutes=settings.password_reset_expire_minutes)))
        self._session.commit()
        return raw_token

    def confirm_password_reset(self, raw_token: str, password: str) -> None:
        """Consume a valid reset token, update the password, and revoke sessions."""
        record = self._tokens.get_password_reset(hash_token(raw_token))
        if record is None or record.used_at is not None or _is_expired(record.expires_at):
            raise TokenValidationError("Invalid or expired password reset token")
        user = self._users.get_by_id(record.user_id)
        if user is None or not user.active:
            raise TokenValidationError("Invalid or expired password reset token")
        user.password_hash = hash_password(password)
        record.used_at = datetime.now(UTC)
        self._tokens.revoke_user_refresh_tokens(user.id)
        self._session.commit()

    def create_invitation(self, inviter: User, payload: InvitationCreateRequest) -> tuple[Invitation, str]:
        """Create an invitation that an external delivery adapter can distribute."""
        if self._users.get_by_email(payload.email):
            raise DomainConflictError("Email address is already in use")
        if payload.department_id and self._departments.get_for_company(payload.department_id, inviter.company_id) is None:
            raise TokenValidationError("Department does not belong to the current company")
        raw_token = generate_opaque_token()
        invitation = Invitation(company_id=inviter.company_id, department_id=payload.department_id, invited_by_user_id=inviter.id, email=payload.email, role=payload.role, token_hash=hash_token(raw_token), expires_at=datetime.now(UTC) + timedelta(days=settings.invitation_expire_days))
        self._invitations.add(invitation)
        self._session.commit()
        self._session.refresh(invitation)
        return invitation, raw_token

    def accept_invitation(self, payload: InvitationAcceptRequest) -> tuple[User, TokenPairResponse]:
        """Create an invited user inside the invitation's company only."""
        invitation = self._invitations.get_by_token_hash(hash_token(payload.token))
        if invitation is None or invitation.accepted_at or invitation.revoked_at or _is_expired(invitation.expires_at):
            raise TokenValidationError("Invalid or expired invitation")
        if self._users.get_by_email(invitation.email):
            raise DomainConflictError("Email address is already in use")
        user = User(company_id=invitation.company_id, department_id=invitation.department_id, role=invitation.role, first_name=payload.first_name.strip(), last_name=payload.last_name.strip(), email=invitation.email, password_hash=hash_password(payload.password))
        invitation.accepted_at = datetime.now(UTC)
        self._users.add(user)
        self._session.flush()
        tokens = self._issue_token_pair(user)
        self._session.commit()
        return user, tokens

    def _issue_token_pair(self, user: User) -> TokenPairResponse:
        """Create and persist a rotated access/refresh JWT pair for a user."""
        access_token, _, _ = create_token(user_id=user.id, company_id=user.company_id, role=user.role, token_type="access", expires_delta=timedelta(minutes=settings.access_token_expire_minutes))
        refresh_token, refresh_id, refresh_expires_at = create_token(user_id=user.id, company_id=user.company_id, role=user.role, token_type="refresh", expires_delta=timedelta(days=settings.refresh_token_expire_days))
        self._tokens.add_refresh_token(RefreshToken(user_id=user.id, token_hash=hash_token(refresh_id), expires_at=refresh_expires_at))
        return TokenPairResponse(access_token=access_token, refresh_token=refresh_token, access_token_expires_in=settings.access_token_expire_minutes * 60)

    @staticmethod
    def _decode(token: str, expected_type: str) -> dict[str, str]:
        """Translate token parser failures into service-layer authentication errors."""
        try:
            return decode_token(token, expected_type)
        except ValueError as exc:
            raise AuthenticationError("Invalid or expired token") from exc
