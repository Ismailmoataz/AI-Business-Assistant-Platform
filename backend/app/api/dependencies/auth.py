"""FastAPI dependencies for authentication and authorization."""

from collections.abc import Callable
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.database.connection import get_db
from app.database.models.enums import UserRole
from app.database.models.user import User
from app.repositories.user_repository import UserRepository

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), session: Session = Depends(get_db)) -> User:
    """Return the active persisted user represented by a valid access token."""
    try:
        claims = decode_token(token, "access")
        user_id = UUID(claims["sub"])
        company_id = UUID(claims["company_id"])
    except (ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = UserRepository(session).get_by_id(user_id)
    if user is None or not user.active or not user.company.active or user.company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_roles(*roles: UserRole) -> Callable[[User], User]:
    """Create an authorization dependency allowing only the supplied roles."""
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        """Reject authenticated users whose persisted role is not permitted."""
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return dependency


def get_current_admin(current_user: User = Depends(require_roles(UserRole.ADMIN))) -> User:
    """Return the current user only when they are an administrator."""
    return current_user


def get_current_manager_or_admin(
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
) -> User:
    """Return the current user only when they are a manager or administrator."""
    return current_user
