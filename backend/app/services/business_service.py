"""Authorization-aware workflows for Phase 2 business records."""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import and_, case, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database.models.business import Activity, Customer, Note, Project, Tag, Task, TaskComment
from app.database.models.documents import Document
from app.database.models.enums import ActivityAction, DocumentVisibility, NoteScope, UserRole
from app.database.models.user import User
from app.repositories.business_repository import BusinessRepository
from app.repositories.department_repository import DepartmentRepository
from app.repositories.user_repository import UserRepository
from app.schemas.business import (
    CustomerCreateRequest, CustomerUpdateRequest, EmployeeUpdateRequest, NoteCreateRequest, NoteUpdateRequest,
    ProjectCreateRequest, ProjectUpdateRequest, TagCreateRequest, TagUpdateRequest, TaskCommentCreateRequest,
    TaskCreateRequest, TaskUpdateRequest,
)


class BusinessNotFoundError(Exception):
    """Raised when a tenant-scoped business record does not exist."""


class BusinessPermissionError(Exception):
    """Raised when the actor is not allowed to perform a business operation."""


class BusinessConflictError(Exception):
    """Raised when a unique business rule is violated."""


class BusinessValidationError(Exception):
    """Raised when referenced company data fails a domain validation rule."""


class BusinessService:
    """Coordinates tenant isolation, role policy, activity records, and persistence."""

    def __init__(self, session: Session) -> None:
        """Create a request-scoped service with tenant-safe repositories."""
        self._session = session
        self._business = BusinessRepository(session)
        self._users = UserRepository(session)
        self._departments = DepartmentRepository(session)

    def _commit(self, entity: object) -> object:
        """Commit, refresh, and translate uniqueness failures consistently."""
        try:
            self._session.commit()
        except IntegrityError as exc:
            self._session.rollback()
            raise BusinessConflictError("A record with those unique values already exists") from exc
        self._session.refresh(entity)
        return entity

    def _activity(self, actor: User, action: ActivityAction, entity: object, summary: str) -> None:
        """Stage an immutable activity event in the current transaction."""
        self._business.add(Activity(company_id=actor.company_id, actor_id=actor.id, action=action, entity_type=entity.__class__.__name__.lower(), entity_id=entity.id, summary=summary))

    def _tags(self, actor: User, tag_ids: list[UUID]) -> list[Tag]:
        """Resolve a complete tag collection without cross-tenant references."""
        tags = self._business.get_tags(actor.company_id, tag_ids)
        if len(tags) != len(set(tag_ids)):
            raise BusinessValidationError("One or more tags were not found in the current company")
        return tags

    def _manager_department_allows(self, actor: User, department_id: UUID | None) -> bool:
        """Return whether an admin/manager can manage a department-scoped record."""
        return actor.role == UserRole.ADMIN or (actor.role == UserRole.MANAGER and actor.department_id is not None and department_id == actor.department_id)

    def _require_management(self, actor: User, department_id: UUID | None) -> None:
        """Enforce admin-wide or manager-own-department management."""
        if not self._manager_department_allows(actor, department_id):
            raise BusinessPermissionError("This resource is outside your management scope")

    def _project_allowed(self, actor: User, project: Project, write: bool = False) -> bool:
        """Apply project read/write policy without leaking cross-tenant records."""
        if actor.role == UserRole.ADMIN:
            return True
        if actor.role == UserRole.MANAGER:
            return project.department_id == actor.department_id or project.owner_id == actor.id
        return not write and (project.owner_id == actor.id or any(task.assignee_id == actor.id for task in project.tasks))

    def list_employees(
        self,
        actor: User,
        offset: int,
        limit: int,
        search: str | None,
        department_id: UUID | None,
        role: Any = None,
        employment_status: Any = None,
        sort: str = "name",
    ) -> tuple[list[User], int]:
        """List company employees, narrowing managers to their department."""
        statement = select(User).options(
            selectinload(User.department),
            selectinload(User.owned_projects),
            selectinload(User.assigned_tasks),
        ).where(User.company_id == actor.company_id)
        if actor.role == UserRole.MANAGER:
            statement = statement.where(User.department_id == actor.department_id)
        if department_id:
            statement = statement.where(User.department_id == department_id)
        if role:
            statement = statement.where(User.role == role)
        if employment_status:
            statement = statement.where(User.employment_status == employment_status)
        if search:
            pattern = f"%{search.strip()}%"
            statement = statement.where(or_(User.first_name.ilike(pattern), User.last_name.ilike(pattern), User.email.ilike(pattern), User.job_title.ilike(pattern)))
        ordering = {
            "name": (User.last_name.asc(), User.first_name.asc()),
            "role": (User.role.asc(), User.last_name.asc(), User.first_name.asc()),
            "status": (User.employment_status.asc(), User.last_name.asc(), User.first_name.asc()),
            "updated": (User.updated_at.desc(),),
        }
        return self._business.page(statement.order_by(*ordering[sort]), offset, limit)  # type: ignore[return-value]

    def get_employee(self, actor: User, employee_id: UUID) -> User:
        """Return a visible employee profile from the current company."""
        employee = self._users.get_for_company(employee_id, actor.company_id)
        if employee is None:
            raise BusinessNotFoundError("Employee was not found")
        if actor.role == UserRole.MANAGER and employee.department_id != actor.department_id:
            raise BusinessPermissionError("Employee is outside your department")
        return employee

    def update_employee(self, actor: User, employee_id: UUID, payload: EmployeeUpdateRequest) -> User:
        """Update an employee profile under role and department boundaries."""
        employee = self.get_employee(actor, employee_id)
        if actor.role == UserRole.EMPLOYEE and employee.id != actor.id:
            raise BusinessPermissionError("Employees may edit only their own profile")
        if actor.role == UserRole.MANAGER and employee.department_id != actor.department_id:
            raise BusinessPermissionError("Employee is outside your department")
        changes = payload.model_dump(exclude_unset=True)
        if actor.role == UserRole.EMPLOYEE:
            forbidden = {"department_id", "manager_id", "employment_status"}
            if forbidden.intersection(changes):
                raise BusinessPermissionError("Employees may not change organizational fields")
        if "department_id" in changes and changes["department_id"]:
            department = self._departments.get_for_company(changes["department_id"], actor.company_id)
            if department is None or not self._manager_department_allows(actor, department.id):
                raise BusinessPermissionError("Invalid department assignment")
        if "manager_id" in changes and changes["manager_id"]:
            manager = self._users.get_for_company(changes["manager_id"], actor.company_id)
            if manager is None or manager.id == employee.id:
                raise BusinessValidationError("manager_id must reference another company employee")
        for field, value in changes.items():
            setattr(employee, field, value)
        self._activity(actor, ActivityAction.UPDATED, employee, "Updated employee profile")
        return self._commit(employee)  # type: ignore[return-value]

    def create_customer(self, actor: User, payload: CustomerCreateRequest) -> Customer:
        """Create a company customer for administrators and managers."""
        if actor.role == UserRole.EMPLOYEE:
            raise BusinessPermissionError("Employees cannot manage customers")
        data = payload.model_dump(exclude={"tag_ids"})
        customer = Customer(company_id=actor.company_id, **data, tags=self._tags(actor, payload.tag_ids))
        self._business.add(customer)
        self._session.flush()
        self._activity(actor, ActivityAction.CREATED, customer, "Created customer")
        return self._commit(customer)  # type: ignore[return-value]

    def update_customer(self, actor: User, entity_id: UUID, payload: CustomerUpdateRequest) -> Customer:
        """Update a customer for administrators and managers."""
        if actor.role == UserRole.EMPLOYEE:
            raise BusinessPermissionError("Employees cannot manage customers")
        customer = self._business.get_customer(actor.company_id, entity_id)
        if customer is None:
            raise BusinessNotFoundError("Customer was not found")
        changes = payload.model_dump(exclude_unset=True, exclude={"tag_ids"})
        for field, value in changes.items():
            setattr(customer, field, value)
        if payload.tag_ids is not None:
            customer.tags = self._tags(actor, payload.tag_ids)
        self._activity(actor, ActivityAction.UPDATED, customer, "Updated customer")
        return self._commit(customer)  # type: ignore[return-value]

    def list_customers(
        self,
        actor: User,
        offset: int,
        limit: int,
        search: str | None,
        status: Any,
        customer_type: Any = None,
        tag_id: UUID | None = None,
        sort: str = "name",
    ) -> tuple[list[Customer], int]:
        """List active customers for a permitted manager or administrator."""
        if actor.role == UserRole.EMPLOYEE:
            raise BusinessPermissionError("Employees cannot view customers")
        statement = select(Customer).options(selectinload(Customer.tags)).where(Customer.company_id == actor.company_id, Customer.deleted_at.is_(None))
        if search:
            pattern = f"%{search.strip()}%"
            statement = statement.where(or_(Customer.name.ilike(pattern), Customer.email.ilike(pattern), Customer.contact_name.ilike(pattern)))
        if status:
            statement = statement.where(Customer.status == status)
        if customer_type:
            statement = statement.where(Customer.customer_type == customer_type)
        if tag_id:
            statement = statement.where(Customer.tags.any(and_(Tag.id == tag_id, Tag.deleted_at.is_(None))))
        ordering = {
            "name": (Customer.name.asc(),),
            "status": (Customer.status.asc(), Customer.name.asc()),
            "updated": (Customer.updated_at.desc(),),
        }
        return self._business.page(statement.order_by(*ordering[sort]), offset, limit)  # type: ignore[return-value]

    def get_customer(self, actor: User, entity_id: UUID) -> Customer:
        """Return a customer when the role has customer visibility."""
        if actor.role == UserRole.EMPLOYEE:
            raise BusinessNotFoundError("Customer was not found")
        customer = self._business.get_customer(actor.company_id, entity_id)
        if customer is None:
            raise BusinessNotFoundError("Customer was not found")
        return customer

    def delete_customer(self, actor: User, entity_id: UUID) -> None:
        """Soft-delete a customer for a permitted manager or administrator."""
        self.soft_delete(actor, self.get_customer(actor, entity_id))

    def create_project(self, actor: User, payload: ProjectCreateRequest) -> Project:
        """Create a project within the actor's permitted department."""
        department_id = payload.department_id or actor.department_id
        self._require_management(actor, department_id)
        if department_id and self._departments.get_for_company(department_id, actor.company_id) is None:
            raise BusinessValidationError("Department was not found")
        owner_id = payload.owner_id or actor.id
        owner = self._users.get_for_company(owner_id, actor.company_id)
        if owner is None or (department_id and owner.department_id != department_id):
            raise BusinessValidationError("Owner must belong to the project department")
        if payload.customer_id and self._business.get_customer(actor.company_id, payload.customer_id) is None:
            raise BusinessValidationError("Customer was not found")
        data = payload.model_dump(exclude={"tag_ids", "owner_id", "department_id"})
        project = Project(company_id=actor.company_id, owner_id=owner_id, department_id=department_id, **data, tags=self._tags(actor, payload.tag_ids))
        self._business.add(project)
        self._session.flush()
        self._activity(actor, ActivityAction.CREATED, project, "Created project")
        return self._commit(project)  # type: ignore[return-value]

    def update_project(self, actor: User, entity_id: UUID, payload: ProjectUpdateRequest) -> Project:
        """Update a project under department management policy."""
        project = self._business.get_project(actor.company_id, entity_id)
        if project is None:
            raise BusinessNotFoundError("Project was not found")
        self._require_management(actor, project.department_id)
        changes = payload.model_dump(exclude_unset=True, exclude={"tag_ids"})
        candidate_department = changes.get("department_id", project.department_id)
        if candidate_department and self._departments.get_for_company(candidate_department, actor.company_id) is None:
            raise BusinessValidationError("Department was not found")
        if not self._manager_department_allows(actor, candidate_department):
            raise BusinessPermissionError("This resource is outside your management scope")
        if "owner_id" in changes:
            owner = self._users.get_for_company(changes["owner_id"], actor.company_id)
            if owner is None or (candidate_department and owner.department_id != candidate_department):
                raise BusinessValidationError("Owner must belong to the project department")
        if "customer_id" in changes and changes["customer_id"] and self._business.get_customer(actor.company_id, changes["customer_id"]) is None:
            raise BusinessValidationError("Customer was not found")
        for field, value in changes.items():
            setattr(project, field, value)
        if payload.tag_ids is not None:
            project.tags = self._tags(actor, payload.tag_ids)
        self._activity(actor, ActivityAction.UPDATED, project, "Updated project")
        return self._commit(project)  # type: ignore[return-value]

    def list_projects(
        self,
        actor: User,
        offset: int,
        limit: int,
        search: str | None,
        status: Any,
        department_id: UUID | None,
        owner_id: UUID | None = None,
        customer_id: UUID | None = None,
        tag_id: UUID | None = None,
        sort: str = "updated",
    ) -> tuple[list[Project], int]:
        """List projects visible through role, ownership, department, or assignment."""
        statement = select(Project).options(selectinload(Project.tags), selectinload(Project.tasks)).where(Project.company_id == actor.company_id, Project.deleted_at.is_(None))
        if actor.role == UserRole.MANAGER:
            statement = statement.where(or_(Project.department_id == actor.department_id, Project.owner_id == actor.id))
        elif actor.role == UserRole.EMPLOYEE:
            statement = statement.where(or_(Project.owner_id == actor.id, Project.tasks.any(Task.assignee_id == actor.id)))
        if department_id:
            statement = statement.where(Project.department_id == department_id)
        if owner_id:
            statement = statement.where(Project.owner_id == owner_id)
        if customer_id:
            statement = statement.where(Project.customer_id == customer_id)
        if tag_id:
            statement = statement.where(Project.tags.any(and_(Tag.id == tag_id, Tag.deleted_at.is_(None))))
        if status:
            statement = statement.where(Project.status == status)
        if search:
            pattern = f"%{search.strip()}%"
            statement = statement.where(or_(Project.name.ilike(pattern), Project.description.ilike(pattern)))
        ordering = {
            "name": (Project.name.asc(), Project.updated_at.desc()),
            "due_date": (Project.end_date.asc().nullslast(), Project.updated_at.desc()),
            "updated": (Project.updated_at.desc(),),
        }
        return self._business.page(statement.order_by(*ordering[sort]), offset, limit)  # type: ignore[return-value]

    def get_project(self, actor: User, entity_id: UUID) -> Project:
        """Return a project only when it is visible to the actor."""
        project = self._business.get_project(actor.company_id, entity_id)
        if project is None or not self._project_allowed(actor, project):
            raise BusinessNotFoundError("Project was not found")
        return project

    def delete_project(self, actor: User, entity_id: UUID) -> None:
        """Soft-delete a project under department management policy."""
        project = self._business.get_project(actor.company_id, entity_id)
        if project is None:
            raise BusinessNotFoundError("Project was not found")
        self._require_management(actor, project.department_id)
        self.soft_delete(actor, project)

    def create_task(self, actor: User, payload: TaskCreateRequest) -> Task:
        """Create a task in a manageable project."""
        project = self._business.get_project(actor.company_id, payload.project_id)
        if project is None:
            raise BusinessNotFoundError("Project was not found")
        self._require_management(actor, project.department_id)
        if payload.assignee_id and self._users.get_for_company(payload.assignee_id, actor.company_id) is None:
            raise BusinessValidationError("Assignee was not found")
        data = payload.model_dump(exclude={"tag_ids", "project_id", "assignee_id"})
        task = Task(company_id=actor.company_id, project_id=project.id, assignee_id=payload.assignee_id, created_by_user_id=actor.id, **data, tags=self._tags(actor, payload.tag_ids))
        self._business.add(task)
        self._session.flush()
        self._activity(actor, ActivityAction.CREATED, task, "Created task")
        return self._commit(task)  # type: ignore[return-value]

    def _task_write_allowed(self, actor: User, task: Task) -> bool:
        """Return whether an actor may mutate a task."""
        return actor.role == UserRole.ADMIN or self._manager_department_allows(actor, task.project.department_id) or task.assignee_id == actor.id

    def update_task(self, actor: User, entity_id: UUID, payload: TaskUpdateRequest) -> Task:
        """Update an assigned task or a managed project task."""
        task = self._business.get_task(actor.company_id, entity_id)
        if task is None:
            raise BusinessNotFoundError("Task was not found")
        if not self._task_write_allowed(actor, task):
            raise BusinessPermissionError("You may update only assigned or managed tasks")
        changes = payload.model_dump(exclude_unset=True, exclude={"tag_ids"})
        if actor.role == UserRole.EMPLOYEE and set(changes) - {"status", "progress"}:
            raise BusinessPermissionError("Employees may update only task status and progress")
        if "assignee_id" in changes and changes["assignee_id"] and self._users.get_for_company(changes["assignee_id"], actor.company_id) is None:
            raise BusinessValidationError("Assignee was not found")
        for field, value in changes.items():
            setattr(task, field, value)
        if payload.tag_ids is not None:
            if actor.role == UserRole.EMPLOYEE:
                raise BusinessPermissionError("Employees may not change task labels")
            task.tags = self._tags(actor, payload.tag_ids)
        self._activity(actor, ActivityAction.UPDATED, task, "Updated task")
        return self._commit(task)  # type: ignore[return-value]

    def list_tasks(
        self,
        actor: User,
        offset: int,
        limit: int,
        project_id: UUID | None,
        status: Any,
        assignee_id: UUID | None,
        search: str | None = None,
        priority: Any = None,
        tag_id: UUID | None = None,
        sort: str = "due_date",
    ) -> tuple[list[Task], int]:
        """List tasks within the actor's permitted assignment or management scope."""
        statement = select(Task).options(selectinload(Task.tags)).join(Project).where(Task.company_id == actor.company_id, Task.deleted_at.is_(None), Project.deleted_at.is_(None))
        if actor.role == UserRole.MANAGER:
            statement = statement.where(or_(Project.department_id == actor.department_id, Project.owner_id == actor.id))
        elif actor.role == UserRole.EMPLOYEE:
            statement = statement.where(Task.assignee_id == actor.id)
        if project_id:
            statement = statement.where(Task.project_id == project_id)
        if status:
            statement = statement.where(Task.status == status)
        if assignee_id:
            statement = statement.where(Task.assignee_id == assignee_id)
        if priority:
            statement = statement.where(Task.priority == priority)
        if tag_id:
            statement = statement.where(Task.tags.any(and_(Tag.id == tag_id, Tag.deleted_at.is_(None))))
        if search:
            pattern = f"%{search.strip()}%"
            statement = statement.where(or_(Task.title.ilike(pattern), Task.description.ilike(pattern)))
        priority_order = case(
            (Task.priority == "urgent", 0),
            (Task.priority == "high", 1),
            (Task.priority == "medium", 2),
            else_=3,
        )
        ordering = {
            "name": (Task.title.asc(), Task.updated_at.desc()),
            "due_date": (Task.due_date.asc().nullslast(), Task.updated_at.desc()),
            "priority": (priority_order.asc(), Task.due_date.asc().nullslast()),
            "updated": (Task.updated_at.desc(),),
        }
        return self._business.page(statement.order_by(*ordering[sort]), offset, limit)  # type: ignore[return-value]

    def get_task(self, actor: User, entity_id: UUID) -> Task:
        """Return a task only when it is visible to the actor."""
        task = self._business.get_task(actor.company_id, entity_id)
        if task is None:
            raise BusinessNotFoundError("Task was not found")
        if actor.role == UserRole.EMPLOYEE and task.assignee_id != actor.id:
            raise BusinessNotFoundError("Task was not found")
        if actor.role == UserRole.MANAGER and not self._manager_department_allows(actor, task.project.department_id) and task.project.owner_id != actor.id:
            raise BusinessNotFoundError("Task was not found")
        return task

    def delete_task(self, actor: User, entity_id: UUID) -> None:
        """Soft-delete a managed task."""
        task = self._business.get_task(actor.company_id, entity_id)
        if task is None:
            raise BusinessNotFoundError("Task was not found")
        self._require_management(actor, task.project.department_id)
        self.soft_delete(actor, task)

    def add_comment(self, actor: User, task_id: UUID, payload: TaskCommentCreateRequest) -> TaskComment:
        """Add a comment to an accessible task."""
        task = self._business.get_task(actor.company_id, task_id)
        if task is None or not (self._task_write_allowed(actor, task) or task.project.owner_id == actor.id):
            raise BusinessNotFoundError("Task was not found")
        comment = TaskComment(task_id=task.id, author_id=actor.id, body=payload.body)
        self._business.add(comment)
        self._session.flush()
        self._activity(actor, ActivityAction.CREATED, comment, "Added task comment")
        return self._commit(comment)  # type: ignore[return-value]

    def create_note(self, actor: User, payload: NoteCreateRequest) -> Note:
        """Create a visibility-scoped note."""
        if payload.scope == NoteScope.COMPANY and actor.role == UserRole.EMPLOYEE:
            raise BusinessPermissionError("Employees cannot create company notes")
        data = payload.model_dump(exclude={"tag_ids"})
        if payload.employee_id:
            self.get_employee(actor, payload.employee_id)
        if payload.customer_id:
            self.get_customer(actor, payload.customer_id)
        if payload.task_id:
            task = self.get_task(actor, payload.task_id)
            if payload.scope == NoteScope.PROJECT:
                data["project_id"] = task.project_id
        if payload.project_id:
            project = self._business.get_project(actor.company_id, payload.project_id)
            if project is None or not self._project_allowed(actor, project):
                raise BusinessNotFoundError("Project was not found")
        if payload.document_id:
            self._note_document(actor, payload.document_id)
        note = Note(company_id=actor.company_id, owner_id=actor.id, **data, tags=self._tags(actor, payload.tag_ids))
        self._business.add(note)
        self._session.flush()
        self._activity(actor, ActivityAction.CREATED, note, "Created note")
        return self._commit(note)  # type: ignore[return-value]

    def _note_document(self, actor: User, document_id: UUID) -> Document:
        """Resolve one document through the existing visibility rules for note links."""
        document = self._session.scalar(
            select(Document).where(Document.id == document_id, Document.company_id == actor.company_id, Document.deleted_at.is_(None))
        )
        visible = document is not None and (
            actor.role == UserRole.ADMIN
            or document.visibility == DocumentVisibility.COMPANY
            or document.owner_id == actor.id
            or (
                document.visibility == DocumentVisibility.DEPARTMENT
                and actor.department_id is not None
                and document.department_id == actor.department_id
            )
        )
        if not visible:
            raise BusinessNotFoundError("Document was not found")
        return document

    def _note_allowed(self, actor: User, note: Note, write: bool = False) -> bool:
        """Return whether an actor may read or edit a note."""
        if actor.role == UserRole.ADMIN or note.owner_id == actor.id:
            return True
        if note.scope == NoteScope.PERSONAL:
            return False
        if note.scope == NoteScope.COMPANY:
            return actor.role == UserRole.MANAGER
        project = self._business.get_project(actor.company_id, note.project_id) if note.project_id else None
        return project is not None and self._project_allowed(actor, project, write=write)

    def update_note(self, actor: User, entity_id: UUID, payload: NoteUpdateRequest) -> Note:
        """Update a visible note when the note policy permits it."""
        note = self._business.get_note(actor.company_id, entity_id)
        if note is None or not self._note_allowed(actor, note, write=True):
            raise BusinessNotFoundError("Note was not found")
        changes = payload.model_dump(exclude_unset=True, exclude={"tag_ids"})
        linked = {
            "employee_id": changes.get("employee_id", note.employee_id),
            "customer_id": changes.get("customer_id", note.customer_id),
            "task_id": changes.get("task_id", note.task_id),
            "document_id": changes.get("document_id", note.document_id),
        }
        if sum(value is not None for value in linked.values()) > 1:
            raise BusinessValidationError("A note may reference at most one employee, customer, task, or document")
        if linked["employee_id"]:
            self.get_employee(actor, linked["employee_id"])
        if linked["customer_id"]:
            self.get_customer(actor, linked["customer_id"])
        if linked["task_id"]:
            task = self.get_task(actor, linked["task_id"])
            if note.scope == NoteScope.PROJECT:
                note.project_id = task.project_id
        if linked["document_id"]:
            self._note_document(actor, linked["document_id"])
        for field, value in changes.items():
            setattr(note, field, value)
        if payload.tag_ids is not None:
            note.tags = self._tags(actor, payload.tag_ids)
        self._activity(actor, ActivityAction.UPDATED, note, "Updated note")
        return self._commit(note)  # type: ignore[return-value]

    def list_notes(
        self,
        actor: User,
        offset: int,
        limit: int,
        scope: Any,
        project_id: UUID | None,
        search: str | None = None,
        owner_id: UUID | None = None,
        employee_id: UUID | None = None,
        customer_id: UUID | None = None,
        task_id: UUID | None = None,
        document_id: UUID | None = None,
        tag_id: UUID | None = None,
        sort: str = "updated",
    ) -> tuple[list[Note], int]:
        """List notes filtered by the actor's scope visibility."""
        statement = select(Note).options(selectinload(Note.tags)).where(Note.company_id == actor.company_id, Note.deleted_at.is_(None))
        if actor.role == UserRole.EMPLOYEE:
            statement = statement.where(
                or_(
                    Note.owner_id == actor.id,
                    Note.project.has(or_(Project.owner_id == actor.id, Project.tasks.any(Task.assignee_id == actor.id))),
                )
            )
        elif actor.role == UserRole.MANAGER:
            statement = statement.where(
                or_(
                    Note.owner_id == actor.id,
                    Note.scope == NoteScope.COMPANY,
                    Note.project.has(or_(Project.department_id == actor.department_id, Project.owner_id == actor.id)),
                )
            )
        if scope:
            statement = statement.where(Note.scope == scope)
        if project_id:
            statement = statement.where(Note.project_id == project_id)
        for field, value in (
            (Note.owner_id, owner_id),
            (Note.employee_id, employee_id),
            (Note.customer_id, customer_id),
            (Note.task_id, task_id),
            (Note.document_id, document_id),
        ):
            if value:
                statement = statement.where(field == value)
        if tag_id:
            statement = statement.where(Note.tags.any(and_(Tag.id == tag_id, Tag.deleted_at.is_(None))))
        if search:
            pattern = f"%{search.strip()}%"
            statement = statement.where(or_(Note.title.ilike(pattern), Note.body.ilike(pattern)))
        ordering = {
            "title": (Note.title.asc(),),
            "updated": (Note.updated_at.desc(),),
        }
        return self._business.page(statement.order_by(*ordering[sort]), offset, limit)  # type: ignore[return-value]

    def get_note(self, actor: User, entity_id: UUID) -> Note:
        """Return a note only when its scope policy permits access."""
        note = self._business.get_note(actor.company_id, entity_id)
        if note is None or not self._note_allowed(actor, note):
            raise BusinessNotFoundError("Note was not found")
        return note

    def delete_note(self, actor: User, entity_id: UUID) -> None:
        """Soft-delete a note under its visibility policy."""
        note = self.get_note(actor, entity_id)
        if note.owner_id != actor.id and actor.role != UserRole.ADMIN:
            raise BusinessPermissionError("Only the owner or an administrator may delete this note")
        self.soft_delete(actor, note)

    def create_tag(self, actor: User, payload: TagCreateRequest) -> Tag:
        """Create a reusable tag for administrators and managers."""
        if actor.role == UserRole.EMPLOYEE:
            raise BusinessPermissionError("Employees cannot manage tags")
        tag = Tag(company_id=actor.company_id, **payload.model_dump())
        self._business.add(tag)
        self._session.flush()
        self._activity(actor, ActivityAction.CREATED, tag, "Created tag")
        return self._commit(tag)  # type: ignore[return-value]

    def update_tag(self, actor: User, entity_id: UUID, payload: TagUpdateRequest) -> Tag:
        """Update a tag for administrators and managers."""
        if actor.role == UserRole.EMPLOYEE:
            raise BusinessPermissionError("Employees cannot manage tags")
        tag = self._business.get_tag(actor.company_id, entity_id)
        if tag is None:
            raise BusinessNotFoundError("Tag was not found")
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(tag, field, value)
        self._activity(actor, ActivityAction.UPDATED, tag, "Updated tag")
        return self._commit(tag)  # type: ignore[return-value]

    def list_tags(self, actor: User, offset: int, limit: int, search: str | None) -> tuple[list[Tag], int]:
        """List active company tags for authenticated employees."""
        statement = select(Tag).options(
            selectinload(Tag.customers),
            selectinload(Tag.projects),
            selectinload(Tag.tasks),
            selectinload(Tag.notes),
        ).where(Tag.company_id == actor.company_id, Tag.deleted_at.is_(None))
        if search:
            statement = statement.where(Tag.name.ilike(f"%{search.strip()}%"))
        return self._business.page(statement.order_by(Tag.name), offset, limit)  # type: ignore[return-value]

    def get_tag(self, actor: User, entity_id: UUID) -> Tag:
        """Return an active tenant tag."""
        tag = self._business.get_tag(actor.company_id, entity_id)
        if tag is None:
            raise BusinessNotFoundError("Tag was not found")
        return tag

    def delete_tag(self, actor: User, entity_id: UUID) -> None:
        """Soft-delete a tag for administrators and managers."""
        if actor.role == UserRole.EMPLOYEE:
            raise BusinessPermissionError("Employees cannot manage tags")
        tag = self.get_tag(actor, entity_id)
        # Preserve the tag row for auditability while removing it from active labels.
        tag.customers.clear()
        tag.projects.clear()
        tag.tasks.clear()
        self.soft_delete(actor, tag)

    def list_activities(self, actor: User, offset: int, limit: int, entity_type: str | None, entity_id: UUID | None = None) -> tuple[list[Activity], int]:
        """List immutable tenant activity history for managers and administrators."""
        if actor.role == UserRole.EMPLOYEE:
            raise BusinessPermissionError("Employees cannot view company activity history")
        statement = select(Activity).where(Activity.company_id == actor.company_id)
        if entity_type:
            statement = statement.where(Activity.entity_type == entity_type.lower())
        if entity_id:
            statement = statement.where(Activity.entity_id == entity_id)
        return self._business.page(statement.order_by(Activity.created_at.desc()), offset, limit)  # type: ignore[return-value]

    def soft_delete(self, actor: User, entity: Customer | Project | Task | Note | Tag) -> None:
        """Soft-delete a business record and write an immutable activity event."""
        entity.deleted_at = datetime.now(UTC)
        self._activity(actor, ActivityAction.DELETED, entity, f"Deleted {entity.__class__.__name__.lower()}")
        self._commit(entity)
