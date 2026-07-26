"""Current-user endpoints."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.database.models.user import User
from app.schemas import UserResponse

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Return the authenticated user's persisted identity and tenant scope."""
    return UserResponse.model_validate(current_user)
