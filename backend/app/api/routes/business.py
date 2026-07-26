"""REST endpoints for company-scoped Phase 2 business data."""

from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database.connection import get_db
from app.database.models.enums import CustomerStatus, CustomerType, EmploymentStatus, NoteScope, ProjectStatus, TaskPriority, TaskStatus, UserRole
from app.database.models.user import User
from app.schemas.business import (
    ActivityPage, ActivityResponse, CustomerCreateRequest, CustomerPage, CustomerResponse, CustomerUpdateRequest,
    EmployeePage, EmployeeResponse, EmployeeUpdateRequest, NoteCreateRequest, NotePage, NoteResponse, NoteUpdateRequest,
    PageMeta, ProjectCreateRequest, ProjectPage, ProjectResponse, ProjectUpdateRequest, TagCreateRequest, TagPage,
    TagResponse, TagUpdateRequest, TaskCommentCreateRequest, TaskCommentResponse, TaskCreateRequest, TaskPage,
    TaskDetailResponse, TaskResponse, TaskUpdateRequest,
)
from app.services.business_service import BusinessConflictError, BusinessNotFoundError, BusinessPermissionError, BusinessService, BusinessValidationError

employees_router = APIRouter(prefix="/employees", tags=["Employees"])
customers_router = APIRouter(prefix="/customers", tags=["Customers"])
projects_router = APIRouter(prefix="/projects", tags=["Projects"])
tasks_router = APIRouter(prefix="/tasks", tags=["Tasks"])
notes_router = APIRouter(prefix="/notes", tags=["Notes"])
tags_router = APIRouter(prefix="/tags", tags=["Tags"])
activity_router = APIRouter(prefix="/activity", tags=["Activity"])

PaginationOffset = Annotated[int, Query(ge=0, description="Number of records to skip")]
PaginationLimit = Annotated[int, Query(ge=1, le=100, description="Maximum records to return")]


def _service(session: Session) -> BusinessService:
    """Create a request-scoped business service."""
    return BusinessService(session)


def _raise_domain_error(exc: Exception) -> None:
    """Translate service-domain failures into stable HTTP semantics."""
    if isinstance(exc, BusinessNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if isinstance(exc, BusinessPermissionError):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    if isinstance(exc, BusinessConflictError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if isinstance(exc, BusinessValidationError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    raise exc


def _page(items: list[Any], total: int, offset: int, limit: int, response_type: Any) -> dict[str, Any]:
    """Construct a consistent paginated serialized response."""
    return {"items": [response_type.model_validate(item) for item in items], "page": PageMeta(offset=offset, limit=limit, total=total)}


@employees_router.get("", response_model=EmployeePage)
def list_employees(offset: PaginationOffset = 0, limit: PaginationLimit = 25, search: str | None = Query(default=None, max_length=200), department_id: UUID | None = None, role: UserRole | None = None, employment_status: EmploymentStatus | None = Query(default=None, alias="status"), sort: Literal["name", "role", "status", "updated"] = "name", current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> dict[str, Any]:
    """List visible employee profiles with pagination and text search."""
    try:
        items, total = _service(session).list_employees(current_user, offset, limit, search, department_id, role, employment_status, sort)
        return _page(items, total, offset, limit, EmployeeResponse)
    except Exception as exc:
        _raise_domain_error(exc)


@employees_router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(employee_id: UUID, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> EmployeeResponse:
    """Return one visible employee profile."""
    try:
        return EmployeeResponse.model_validate(_service(session).get_employee(current_user, employee_id))
    except Exception as exc:
        _raise_domain_error(exc)


@employees_router.patch("/{employee_id}", response_model=EmployeeResponse)
def update_employee(employee_id: UUID, payload: EmployeeUpdateRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> EmployeeResponse:
    """Update an employee profile subject to role policy."""
    try:
        return EmployeeResponse.model_validate(_service(session).update_employee(current_user, employee_id, payload))
    except Exception as exc:
        _raise_domain_error(exc)


@customers_router.get("", response_model=CustomerPage)
def list_customers(offset: PaginationOffset = 0, limit: PaginationLimit = 25, search: str | None = Query(default=None, max_length=200), status_filter: CustomerStatus | None = Query(default=None, alias="status"), customer_type: CustomerType | None = None, tag_id: UUID | None = None, sort: Literal["name", "status", "updated"] = "name", current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> dict[str, Any]:
    """List tenant customers with search, filtering, and pagination."""
    try:
        items, total = _service(session).list_customers(current_user, offset, limit, search, status_filter, customer_type, tag_id, sort)
        return _page(items, total, offset, limit, CustomerResponse)
    except Exception as exc:
        _raise_domain_error(exc)


@customers_router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerCreateRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> CustomerResponse:
    """Create a customer in the authenticated tenant."""
    try:
        return CustomerResponse.model_validate(_service(session).create_customer(current_user, payload))
    except Exception as exc:
        _raise_domain_error(exc)


@customers_router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: UUID, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> CustomerResponse:
    """Return one visible customer."""
    try:
        return CustomerResponse.model_validate(_service(session).get_customer(current_user, customer_id))
    except Exception as exc:
        _raise_domain_error(exc)


@customers_router.patch("/{customer_id}", response_model=CustomerResponse)
def update_customer(customer_id: UUID, payload: CustomerUpdateRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> CustomerResponse:
    """Update a customer in the authenticated tenant."""
    try:
        return CustomerResponse.model_validate(_service(session).update_customer(current_user, customer_id, payload))
    except Exception as exc:
        _raise_domain_error(exc)


@customers_router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: UUID, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> Response:
    """Soft-delete a customer while retaining its audit trail."""
    try:
        _service(session).delete_customer(current_user, customer_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as exc:
        _raise_domain_error(exc)


@projects_router.get("", response_model=ProjectPage)
def list_projects(offset: PaginationOffset = 0, limit: PaginationLimit = 25, search: str | None = Query(default=None, max_length=200), status_filter: ProjectStatus | None = Query(default=None, alias="status"), department_id: UUID | None = None, owner_id: UUID | None = None, customer_id: UUID | None = None, tag_id: UUID | None = None, sort: Literal["name", "due_date", "updated"] = "updated", current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> dict[str, Any]:
    """List projects visible through the caller's role and scope."""
    try:
        items, total = _service(session).list_projects(current_user, offset, limit, search, status_filter, department_id, owner_id, customer_id, tag_id, sort)
        return _page(items, total, offset, limit, ProjectResponse)
    except Exception as exc:
        _raise_domain_error(exc)


@projects_router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreateRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> ProjectResponse:
    """Create a project in a manageable department."""
    try:
        return ProjectResponse.model_validate(_service(session).create_project(current_user, payload))
    except Exception as exc:
        _raise_domain_error(exc)


@projects_router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: UUID, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> ProjectResponse:
    """Return one visible project."""
    try:
        return ProjectResponse.model_validate(_service(session).get_project(current_user, project_id))
    except Exception as exc:
        _raise_domain_error(exc)


@projects_router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: UUID, payload: ProjectUpdateRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> ProjectResponse:
    """Update a managed project."""
    try:
        return ProjectResponse.model_validate(_service(session).update_project(current_user, project_id, payload))
    except Exception as exc:
        _raise_domain_error(exc)


@projects_router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: UUID, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> Response:
    """Soft-delete a managed project."""
    try:
        _service(session).delete_project(current_user, project_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as exc:
        _raise_domain_error(exc)


@tasks_router.get("", response_model=TaskPage)
def list_tasks(offset: PaginationOffset = 0, limit: PaginationLimit = 25, search: str | None = Query(default=None, max_length=250), project_id: UUID | None = None, assignee_id: UUID | None = None, status_filter: TaskStatus | None = Query(default=None, alias="status"), priority: TaskPriority | None = None, tag_id: UUID | None = None, sort: Literal["name", "due_date", "priority", "updated"] = "due_date", current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> dict[str, Any]:
    """List tasks visible through assignment or management scope."""
    try:
        items, total = _service(session).list_tasks(current_user, offset, limit, project_id, status_filter, assignee_id, search, priority, tag_id, sort)
        return _page(items, total, offset, limit, TaskResponse)
    except Exception as exc:
        _raise_domain_error(exc)


@tasks_router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreateRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> TaskResponse:
    """Create a task in a manageable project."""
    try:
        return TaskResponse.model_validate(_service(session).create_task(current_user, payload))
    except Exception as exc:
        _raise_domain_error(exc)


@tasks_router.get("/{task_id}", response_model=TaskDetailResponse)
def get_task(task_id: UUID, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> TaskDetailResponse:
    """Return one visible task."""
    try:
        return TaskDetailResponse.model_validate(_service(session).get_task(current_user, task_id))
    except Exception as exc:
        _raise_domain_error(exc)


@tasks_router.patch("/{task_id}", response_model=TaskResponse)
def update_task(task_id: UUID, payload: TaskUpdateRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> TaskResponse:
    """Update a managed or assigned task."""
    try:
        return TaskResponse.model_validate(_service(session).update_task(current_user, task_id, payload))
    except Exception as exc:
        _raise_domain_error(exc)


@tasks_router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: UUID, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> Response:
    """Soft-delete a managed task."""
    try:
        _service(session).delete_task(current_user, task_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as exc:
        _raise_domain_error(exc)


@tasks_router.post("/{task_id}/comments", response_model=TaskCommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(task_id: UUID, payload: TaskCommentCreateRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> TaskCommentResponse:
    """Add an immutable comment to an accessible task."""
    try:
        return TaskCommentResponse.model_validate(_service(session).add_comment(current_user, task_id, payload))
    except Exception as exc:
        _raise_domain_error(exc)


@notes_router.get("", response_model=NotePage)
def list_notes(offset: PaginationOffset = 0, limit: PaginationLimit = 25, scope: NoteScope | None = None, project_id: UUID | None = None, search: str | None = Query(default=None, max_length=250), owner_id: UUID | None = None, employee_id: UUID | None = None, customer_id: UUID | None = None, task_id: UUID | None = None, document_id: UUID | None = None, tag_id: UUID | None = None, sort: Literal["title", "updated"] = "updated", current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> dict[str, Any]:
    """List notes visible under their personal, company, or project scope."""
    try:
        items, total = _service(session).list_notes(current_user, offset, limit, scope, project_id, search, owner_id, employee_id, customer_id, task_id, document_id, tag_id, sort)
        return _page(items, total, offset, limit, NoteResponse)
    except Exception as exc:
        _raise_domain_error(exc)


@notes_router.post("", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(payload: NoteCreateRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> NoteResponse:
    """Create a personal, company, or project note."""
    try:
        return NoteResponse.model_validate(_service(session).create_note(current_user, payload))
    except Exception as exc:
        _raise_domain_error(exc)


@notes_router.get("/{note_id}", response_model=NoteResponse)
def get_note(note_id: UUID, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> NoteResponse:
    """Return one visible note."""
    try:
        return NoteResponse.model_validate(_service(session).get_note(current_user, note_id))
    except Exception as exc:
        _raise_domain_error(exc)


@notes_router.patch("/{note_id}", response_model=NoteResponse)
def update_note(note_id: UUID, payload: NoteUpdateRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> NoteResponse:
    """Update a note permitted by its scope policy."""
    try:
        return NoteResponse.model_validate(_service(session).update_note(current_user, note_id, payload))
    except Exception as exc:
        _raise_domain_error(exc)


@notes_router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: UUID, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> Response:
    """Soft-delete a note while preserving activity history."""
    try:
        _service(session).delete_note(current_user, note_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as exc:
        _raise_domain_error(exc)


@tags_router.get("", response_model=TagPage)
def list_tags(offset: PaginationOffset = 0, limit: PaginationLimit = 25, search: str | None = Query(default=None, max_length=80), current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> dict[str, Any]:
    """List active tags available in the current tenant."""
    try:
        items, total = _service(session).list_tags(current_user, offset, limit, search)
        return _page(items, total, offset, limit, TagResponse)
    except Exception as exc:
        _raise_domain_error(exc)


@tags_router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
def create_tag(payload: TagCreateRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> TagResponse:
    """Create a reusable company tag."""
    try:
        return TagResponse.model_validate(_service(session).create_tag(current_user, payload))
    except Exception as exc:
        _raise_domain_error(exc)


@tags_router.get("/{tag_id}", response_model=TagResponse)
def get_tag(tag_id: UUID, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> TagResponse:
    """Return one active tenant tag."""
    try:
        return TagResponse.model_validate(_service(session).get_tag(current_user, tag_id))
    except Exception as exc:
        _raise_domain_error(exc)


@tags_router.patch("/{tag_id}", response_model=TagResponse)
def update_tag(tag_id: UUID, payload: TagUpdateRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> TagResponse:
    """Update a reusable company tag."""
    try:
        return TagResponse.model_validate(_service(session).update_tag(current_user, tag_id, payload))
    except Exception as exc:
        _raise_domain_error(exc)


@tags_router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(tag_id: UUID, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> Response:
    """Soft-delete a tag while retaining linked record history."""
    try:
        _service(session).delete_tag(current_user, tag_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as exc:
        _raise_domain_error(exc)


@activity_router.get("", response_model=ActivityPage)
def list_activity(offset: PaginationOffset = 0, limit: PaginationLimit = 25, entity_type: str | None = Query(default=None, max_length=80), entity_id: UUID | None = None, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> dict[str, Any]:
    """List immutable activity history for authorized company leaders."""
    try:
        items, total = _service(session).list_activities(current_user, offset, limit, entity_type, entity_id)
        return _page(items, total, offset, limit, ActivityResponse)
    except Exception as exc:
        _raise_domain_error(exc)
