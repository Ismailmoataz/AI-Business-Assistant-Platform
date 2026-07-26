"""Tenant-safe employee invitation endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_admin
from app.database.connection import get_db
from app.database.models.user import User
from app.schemas import InvitationAcceptRequest, InvitationCreateRequest, InvitationCreateResponse, TokenPairResponse
from app.services.auth_service import AuthService, DomainConflictError, TokenValidationError

router = APIRouter(prefix="/invitations", tags=["Invitations"])


@router.post("", response_model=InvitationCreateResponse, status_code=status.HTTP_201_CREATED)
def create_invitation(
    payload: InvitationCreateRequest,
    current_user: User = Depends(get_current_admin),
    session: Session = Depends(get_db),
) -> InvitationCreateResponse:
    """Create an administrator-authorized invitation in the current tenant only."""
    try:
        invitation, raw_token = AuthService(session).create_invitation(current_user, payload)
    except DomainConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except TokenValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return InvitationCreateResponse(invitation_id=invitation.id, email=invitation.email, expires_at=invitation.expires_at, invitation_token=raw_token)


@router.post("/accept", response_model=TokenPairResponse, status_code=status.HTTP_201_CREATED)
def accept_invitation(payload: InvitationAcceptRequest, session: Session = Depends(get_db)) -> TokenPairResponse:
    """Accept a one-time invitation and issue tokens for the invitation's tenant."""
    try:
        _, tokens = AuthService(session).accept_invitation(payload)
    except TokenValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except DomainConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return tokens
