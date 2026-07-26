"""Enumerations persisted by the identity domain."""

from enum import StrEnum


class UserRole(StrEnum):
    """Roles supported by the initial authorization policy."""

    ADMIN = "admin"
    MANAGER = "manager"
    EMPLOYEE = "employee"


class EmploymentStatus(StrEnum):
    """Lifecycle state for an employee profile."""

    ACTIVE = "active"
    ON_LEAVE = "on_leave"
    INACTIVE = "inactive"


class CustomerType(StrEnum):
    """Kinds of customers supported by the business domain."""

    COMPANY = "company"
    INDIVIDUAL = "individual"


class CustomerStatus(StrEnum):
    """Customer relationship states."""

    ACTIVE = "active"
    PROSPECT = "prospect"
    INACTIVE = "inactive"


class ProjectStatus(StrEnum):
    """Project lifecycle states."""

    PLANNING = "planning"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TaskStatus(StrEnum):
    """Task workflow states."""

    TODO = "todo"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    BLOCKED = "blocked"
    DONE = "done"


class TaskPriority(StrEnum):
    """Task urgency levels."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class NoteScope(StrEnum):
    """Visibility scopes for notes."""

    PERSONAL = "personal"
    COMPANY = "company"
    PROJECT = "project"


class ActivityAction(StrEnum):
    """Audited business-data mutations."""

    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"


class DocumentVisibility(StrEnum):
    """Audience scopes for folders and documents."""

    PRIVATE = "private"
    DEPARTMENT = "department"
    COMPANY = "company"


class DocumentStatus(StrEnum):
    """Document lifecycle states."""

    ACTIVE = "active"
    ARCHIVED = "archived"
