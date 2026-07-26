"""Company and department management endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_manager_or_admin
from app.database.connection import get_db
from app.database.models.user import User
from app.schemas import CompanyResponse, UserResponse
from app.schemas.company import DepartmentCreateRequest, DepartmentResponse, UserDepartmentUpdateRequest
from app.services.company_service import CompanyService, DepartmentConflictError, TenantAccessError

companies_router = APIRouter(prefix="/companies", tags=["Companies"])
departments_router = APIRouter(prefix="/departments", tags=["Departments"])


@companies_router.get("/me", response_model=CompanyResponse)
def get_company(current_user: User = Depends(get_current_manager_or_admin)) -> CompanyResponse:
    """Return company information visible to managers and administrators."""
    return CompanyResponse.model_validate(current_user.company)


@departments_router.get("", response_model=list[DepartmentResponse])
def list_departments(current_user: User = Depends(get_current_manager_or_admin), session: Session = Depends(get_db)) -> list[DepartmentResponse]:
    """List only the departments belonging to the authenticated user's company."""
    return [DepartmentResponse.model_validate(item) for item in CompanyService(session).list_departments(current_user)]


@departments_router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
def create_department(payload: DepartmentCreateRequest, current_user: User = Depends(get_current_manager_or_admin), session: Session = Depends(get_db)) -> DepartmentResponse:
    """Create a department in the authenticated user's company."""
    try:
        department = CompanyService(session).create_department(current_user, payload)
    except DepartmentConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return DepartmentResponse.model_validate(department)


@companies_router.patch("/users/{user_id}/department", response_model=UserResponse)
def assign_user_department(user_id: UUID, payload: UserDepartmentUpdateRequest, current_user: User = Depends(get_current_manager_or_admin), session: Session = Depends(get_db)) -> UserResponse:
    """Assign a same-company employee to a department under role-specific policy."""
    try:
        target_user = CompanyService(session).assign_department(current_user, user_id, payload.department_id)
    except TenantAccessError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return UserResponse.model_validate(target_user)
