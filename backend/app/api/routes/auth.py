"""Authentication and account-recovery endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.schemas import (
    GoogleAuthorizationResponse, LoginRequest, LogoutRequest, OperationMessageResponse, PasswordResetConfirmRequest,
    PasswordResetRequest, RefreshRequest, RegisterRequest, RegisterResponse, TokenPairResponse,
)
from app.services.auth_service import AuthService, AuthenticationError, DomainConflictError, TokenValidationError
from app.services.google_oauth_service import GoogleOAuthConfigurationError, GoogleOAuthService
from app.services.infrastructure import get_redis_client

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _service(session: Session) -> AuthService:
    """Create the request-scoped authentication service."""
    return AuthService(session)


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, session: Session = Depends(get_db)) -> RegisterResponse:
    """Register a company and create its first administrator."""
    try:
        company, user, tokens = _service(session).register_company_admin(payload)
    except DomainConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return RegisterResponse(company=company, user=user, tokens=tokens)


@router.post("/login", response_model=TokenPairResponse)
def login(payload: LoginRequest, session: Session = Depends(get_db)) -> TokenPairResponse:
    """Authenticate local credentials and issue an access/refresh pair."""
    try:
        return _service(session).login(payload)
    except AuthenticationError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc), headers={"WWW-Authenticate": "Bearer"}) from exc


@router.post("/refresh", response_model=TokenPairResponse)
def refresh(payload: RefreshRequest, session: Session = Depends(get_db)) -> TokenPairResponse:
    """Rotate a valid refresh token."""
    try:
        return _service(session).refresh(payload.refresh_token)
    except AuthenticationError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc), headers={"WWW-Authenticate": "Bearer"}) from exc


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: LogoutRequest, session: Session = Depends(get_db)) -> Response:
    """Revoke the supplied refresh token without exposing token existence."""
    try:
        _service(session).logout(payload.refresh_token)
    except AuthenticationError:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/password-reset/request", response_model=OperationMessageResponse, status_code=status.HTTP_202_ACCEPTED)
def request_password_reset(payload: PasswordResetRequest, session: Session = Depends(get_db)) -> OperationMessageResponse:
    """Create a reset token for a future email-delivery adapter without account enumeration."""
    _service(session).request_password_reset(payload.email)
    return OperationMessageResponse(message="If the account exists, password-reset instructions will be sent")


@router.post("/password-reset/confirm", response_model=OperationMessageResponse)
def confirm_password_reset(payload: PasswordResetConfirmRequest, session: Session = Depends(get_db)) -> OperationMessageResponse:
    """Set a new password using a valid one-time reset token."""
    try:
        _service(session).confirm_password_reset(payload.token, payload.password)
    except TokenValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return OperationMessageResponse(message="Password has been reset")


@router.get("/google/authorize-url", response_model=GoogleAuthorizationResponse)
def google_authorize_url() -> GoogleAuthorizationResponse:
    """Return a Google OAuth authorization URL or a graceful configuration error."""
    try:
        authorization_url = GoogleOAuthService(get_redis_client()).create_authorization_url()
    except GoogleOAuthConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return GoogleAuthorizationResponse(authorization_url=authorization_url)
