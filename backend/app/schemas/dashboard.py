"""Read-only contracts for the executive dashboard overview."""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.database.models.enums import CustomerStatus, EmploymentStatus, ProjectStatus, TaskPriority, TaskStatus, UserRole
from app.schemas.auth import CompanyResponse, UserResponse
from app.schemas.business import ActivityResponse
from app.schemas.conversations import ConversationResponse


class DashboardKpis(BaseModel):
    """Exact tenant-authorized headline metrics."""

    active_projects: int
    open_tasks: int
    completed_tasks: int
    employees: int
    customers: int | None
    documents: int
    storage_bytes: int | None
    ai_conversations: int
    notes: int


class ExecutiveBrief(BaseModel):
    """An AI-generated brief or an explicitly labelled live-data fallback."""

    content: str
    status: Literal["generated", "fallback"]
    generated_at: datetime
    unavailable_reason: str | None = None


class DashboardTaskItem(BaseModel):
    """A current-user task shown in the My Work widget."""

    id: UUID
    project_id: UUID
    project_name: str
    title: str
    status: TaskStatus
    priority: TaskPriority
    progress: int
    due_date: date | None


class MyWorkSummary(BaseModel):
    """Current-user assignment totals and the highest-priority work items."""

    assigned: int
    due_today: int
    overdue: int
    upcoming: int
    items: list[DashboardTaskItem]


class DashboardDocumentItem(BaseModel):
    """Visible document metadata needed by the dashboard."""

    id: UUID
    title: str
    filename: str
    mime_type: str
    size_bytes: int
    processing_status: str
    updated_at: datetime


class DashboardDocuments(BaseModel):
    """Document lifecycle totals and recent visible files."""

    uploaded: int
    processing: int
    ready: int
    failed: int
    recent: list[DashboardDocumentItem]


class DashboardProjectItem(BaseModel):
    """Visible project progress, health, and deadline metadata."""

    id: UUID
    name: str
    status: ProjectStatus
    progress: int
    health: Literal["on_track", "watch", "at_risk", "planned"]
    end_date: date | None
    open_tasks: int
    overdue_tasks: int
    updated_at: datetime


class DashboardCustomerItem(BaseModel):
    """Customer metadata safe for a management dashboard."""

    id: UUID
    name: str
    status: CustomerStatus
    contact_name: str | None
    created_at: datetime
    updated_at: datetime


class DashboardCustomers(BaseModel):
    """Role-aware recent customer records and activity."""

    available: bool
    unavailable_reason: str | None = None
    recently_added: list[DashboardCustomerItem]
    recently_updated: list[DashboardCustomerItem]
    activity: list[ActivityResponse]


class DashboardEmployeeItem(BaseModel):
    """Employee identity and workload metadata used by dashboard lists."""

    id: UUID
    first_name: str
    last_name: str
    role: UserRole
    job_title: str | None
    employment_status: EmploymentStatus
    assigned_task_count: int
    updated_at: datetime


class DashboardEmployees(BaseModel):
    """Visible employee updates, workload, and role-authorized activity."""

    recently_updated: list[DashboardEmployeeItem]
    workload: list[DashboardEmployeeItem]
    activity_available: bool
    activity: list[ActivityResponse]


class DashboardOverviewResponse(BaseModel):
    """One cohesive, bounded snapshot for the executive dashboard."""

    user: UserResponse
    company: CompanyResponse
    kpis: DashboardKpis
    brief: ExecutiveBrief
    my_work: MyWorkSummary
    documents: DashboardDocuments
    projects: list[DashboardProjectItem]
    conversations: list[ConversationResponse]
    customers: DashboardCustomers
    employees: DashboardEmployees
