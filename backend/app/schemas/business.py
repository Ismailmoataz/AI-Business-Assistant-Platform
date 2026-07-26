"""Typed request and response contracts for company business data."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.database.models.enums import CustomerStatus, CustomerType, EmploymentStatus, NoteScope, ProjectStatus, TaskPriority, TaskStatus


class PageMeta(BaseModel):
    """Pagination metadata shared by collection responses."""

    offset: int
    limit: int
    total: int


class EmployeeUpdateRequest(BaseModel):
    """Administrator or manager editable employee profile fields."""

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    department_id: UUID | None = None
    job_title: str | None = Field(default=None, max_length=150)
    phone: str | None = Field(default=None, max_length=50)
    avatar_key: str | None = Field(default=None, max_length=512)
    hire_date: date | None = None
    manager_id: UUID | None = None
    employment_status: EmploymentStatus | None = None

    @field_validator("first_name", "last_name", "job_title", "phone", "avatar_key")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        """Trim text and reject supplied values that contain only whitespace."""
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Field must not be blank")
        return value


class EmployeeResponse(BaseModel):
    """Business-safe employee profile representation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    department_id: UUID | None
    department_name: str | None
    manager_id: UUID | None
    first_name: str
    last_name: str
    email: EmailStr
    role: str
    job_title: str | None
    phone: str | None
    avatar_key: str | None
    hire_date: date | None
    employment_status: EmploymentStatus
    active: bool
    assigned_project_count: int
    assigned_task_count: int
    created_at: datetime
    updated_at: datetime


class EmployeePage(BaseModel):
    """Paginated employee collection."""

    items: list[EmployeeResponse]
    page: PageMeta


class CustomerCreateRequest(BaseModel):
    """Payload used to create a customer."""

    customer_type: CustomerType
    name: str = Field(min_length=1, max_length=200)
    status: CustomerStatus = CustomerStatus.PROSPECT
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    contact_name: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=10000)
    tag_ids: list[UUID] = Field(default_factory=list, max_length=50)

    @field_validator("name", "phone", "contact_name", "notes")
    @classmethod
    def trim_text(cls, value: str | None) -> str | None:
        """Normalize user-entered customer text."""
        return value.strip() if value else value


class CustomerUpdateRequest(CustomerCreateRequest):
    """Partial payload used to update a customer."""

    customer_type: CustomerType | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    status: CustomerStatus | None = None
    tag_ids: list[UUID] | None = Field(default=None, max_length=50)


class TagResponse(BaseModel):
    """Tenant-scoped tag representation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    color: str | None
    customer_count: int = 0
    project_count: int = 0
    task_count: int = 0
    note_count: int = 0


class CustomerResponse(BaseModel):
    """Customer representation including assigned tags."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    customer_type: CustomerType
    status: CustomerStatus
    name: str
    email: EmailStr | None
    phone: str | None
    contact_name: str | None
    notes: str | None
    tags: list[TagResponse]
    created_at: datetime
    updated_at: datetime


class CustomerPage(BaseModel):
    """Paginated customer collection."""

    items: list[CustomerResponse]
    page: PageMeta


class ProjectCreateRequest(BaseModel):
    """Payload used to create a project."""

    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=20000)
    status: ProjectStatus = ProjectStatus.PLANNING
    owner_id: UUID | None = None
    customer_id: UUID | None = None
    department_id: UUID | None = None
    start_date: date | None = None
    end_date: date | None = None
    tag_ids: list[UUID] = Field(default_factory=list, max_length=50)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        """Trim a required project name."""
        value = value.strip()
        if not value:
            raise ValueError("Name must not be blank")
        return value

    @model_validator(mode="after")
    def validate_dates(self) -> "ProjectCreateRequest":
        """Reject an end date that precedes the start date."""
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class ProjectUpdateRequest(ProjectCreateRequest):
    """Partial payload used to update a project."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    status: ProjectStatus | None = None
    tag_ids: list[UUID] | None = Field(default=None, max_length=50)


class ProjectResponse(BaseModel):
    """Project representation including tags."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    department_id: UUID | None
    customer_id: UUID | None
    owner_id: UUID
    name: str
    description: str | None
    status: ProjectStatus
    start_date: date | None
    end_date: date | None
    tags: list[TagResponse]
    created_at: datetime
    updated_at: datetime


class ProjectPage(BaseModel):
    """Paginated project collection."""

    items: list[ProjectResponse]
    page: PageMeta


class TaskCreateRequest(BaseModel):
    """Payload used to create a project task."""

    project_id: UUID
    title: str = Field(min_length=1, max_length=250)
    description: str | None = Field(default=None, max_length=20000)
    assignee_id: UUID | None = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    progress: int = Field(default=0, ge=0, le=100)
    due_date: date | None = None
    tag_ids: list[UUID] = Field(default_factory=list, max_length=50)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        """Trim a task title and reject whitespace-only values."""
        value = value.strip()
        if not value:
            raise ValueError("Title must not be blank")
        return value


class TaskUpdateRequest(BaseModel):
    """Partial payload used to update a task."""

    title: str | None = Field(default=None, min_length=1, max_length=250)
    description: str | None = Field(default=None, max_length=20000)
    assignee_id: UUID | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    due_date: date | None = None
    tag_ids: list[UUID] | None = Field(default=None, max_length=50)


class TaskCommentResponse(BaseModel):
    """Immutable task comment representation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    author_id: UUID
    body: str
    created_at: datetime
    updated_at: datetime


class TaskResponse(BaseModel):
    """Task representation including labels and progress."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    project_id: UUID
    assignee_id: UUID | None
    created_by_user_id: UUID
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    progress: int
    due_date: date | None
    tags: list[TagResponse]
    created_at: datetime
    updated_at: datetime


class TaskDetailResponse(TaskResponse):
    """Task detail representation including immutable comments."""

    comments: list[TaskCommentResponse]


class TaskPage(BaseModel):
    """Paginated task collection."""

    items: list[TaskResponse]
    page: PageMeta


class TaskCommentCreateRequest(BaseModel):
    """Payload used to comment on an accessible task."""

    body: str = Field(min_length=1, max_length=10000)

    @field_validator("body")
    @classmethod
    def normalize_body(cls, value: str) -> str:
        """Trim comments and reject whitespace-only content."""
        value = value.strip()
        if not value:
            raise ValueError("Comment must not be blank")
        return value


class NoteCreateRequest(BaseModel):
    """Payload used to create a note."""

    scope: NoteScope
    title: str = Field(min_length=1, max_length=250)
    body: str = Field(min_length=1, max_length=50000)
    project_id: UUID | None = None
    employee_id: UUID | None = None
    customer_id: UUID | None = None
    task_id: UUID | None = None
    document_id: UUID | None = None
    tag_ids: list[UUID] = Field(default_factory=list, max_length=50)

    @model_validator(mode="after")
    def validate_scope(self) -> "NoteCreateRequest":
        """Require project notes to reference a project and other notes not to."""
        direct_targets = [self.employee_id, self.customer_id, self.task_id, self.document_id]
        if sum(value is not None for value in direct_targets) > 1:
            raise ValueError("A note may reference at most one employee, customer, task, or document")
        if self.scope == NoteScope.PROJECT and self.project_id is None and self.task_id is None:
            raise ValueError("project_id or task_id is required for project notes")
        if self.scope != NoteScope.PROJECT and self.project_id is not None:
            raise ValueError("project_id is available only for project notes")
        return self


class NoteUpdateRequest(BaseModel):
    """Partial payload used to update a note without changing its visibility scope."""

    title: str | None = Field(default=None, min_length=1, max_length=250)
    body: str | None = Field(default=None, min_length=1, max_length=50000)
    employee_id: UUID | None = None
    customer_id: UUID | None = None
    task_id: UUID | None = None
    document_id: UUID | None = None
    tag_ids: list[UUID] | None = Field(default=None, max_length=50)

    @model_validator(mode="after")
    def validate_target(self) -> "NoteUpdateRequest":
        """Keep non-project relationship updates singular."""
        targets = [self.employee_id, self.customer_id, self.task_id, self.document_id]
        if sum(value is not None for value in targets) > 1:
            raise ValueError("A note may reference at most one employee, customer, task, or document")
        return self


class NoteResponse(BaseModel):
    """Note representation excluding soft-delete metadata."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    project_id: UUID | None
    owner_id: UUID
    employee_id: UUID | None
    customer_id: UUID | None
    task_id: UUID | None
    document_id: UUID | None
    scope: NoteScope
    title: str
    body: str
    tags: list[TagResponse]
    created_at: datetime
    updated_at: datetime


class NotePage(BaseModel):
    """Paginated note collection."""

    items: list[NoteResponse]
    page: PageMeta


class TagCreateRequest(BaseModel):
    """Payload used to create a reusable company tag."""

    name: str = Field(min_length=1, max_length=80)
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        """Normalize a tag name for company-scoped uniqueness."""
        value = value.strip().lower()
        if not value:
            raise ValueError("Name must not be blank")
        return value


class TagUpdateRequest(TagCreateRequest):
    """Partial payload used to update a tag."""

    name: str | None = Field(default=None, min_length=1, max_length=80)


class TagPage(BaseModel):
    """Paginated tag collection."""

    items: list[TagResponse]
    page: PageMeta


class ActivityResponse(BaseModel):
    """Immutable activity-history event representation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    actor_id: UUID | None
    action: str
    entity_type: str
    entity_id: UUID
    summary: str
    created_at: datetime


class ActivityPage(BaseModel):
    """Paginated activity-history collection."""

    items: list[ActivityResponse]
    page: PageMeta
