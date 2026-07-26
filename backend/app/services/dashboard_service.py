"""Executive dashboard orchestration and graceful AI brief generation."""

import json
from datetime import UTC, date, datetime, timedelta

from app.ai.providers import ChatProvider
from app.database.models.business import Project
from app.database.models.enums import ProjectStatus, TaskStatus, UserRole
from app.database.models.user import User
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.dashboard_repository import DashboardRepository
from app.schemas.auth import CompanyResponse, UserResponse
from app.schemas.business import ActivityResponse
from app.schemas.conversations import ConversationResponse
from app.schemas.dashboard import (
    DashboardCustomerItem,
    DashboardCustomers,
    DashboardDocumentItem,
    DashboardDocuments,
    DashboardEmployeeItem,
    DashboardEmployees,
    DashboardKpis,
    DashboardOverviewResponse,
    DashboardProjectItem,
    DashboardTaskItem,
    ExecutiveBrief,
    MyWorkSummary,
)


class DashboardService:
    """Build a bounded dashboard snapshot without creating or mutating business data."""

    def __init__(self, repository: DashboardRepository, conversations: ConversationRepository, chat_provider: ChatProvider | None = None) -> None:
        self._repository = repository
        self._conversations = conversations
        self._chat_provider = chat_provider

    @staticmethod
    def _project_item(project: Project, today: date) -> DashboardProjectItem:
        tasks = [task for task in project.tasks if task.deleted_at is None]
        open_tasks = [task for task in tasks if task.status != TaskStatus.DONE]
        overdue_tasks = [task for task in open_tasks if task.due_date and task.due_date < today]
        progress = round(sum(task.progress for task in tasks) / len(tasks)) if tasks else 0
        if project.end_date and project.end_date < today or overdue_tasks or any(task.status == TaskStatus.BLOCKED for task in open_tasks):
            health = "at_risk"
        elif project.status == ProjectStatus.PLANNING:
            health = "planned"
        elif project.end_date and project.end_date <= today + timedelta(days=7) and progress < 75:
            health = "watch"
        else:
            health = "on_track"
        return DashboardProjectItem(
            id=project.id,
            name=project.name,
            status=project.status,
            progress=progress,
            health=health,
            end_date=project.end_date,
            open_tasks=len(open_tasks),
            overdue_tasks=len(overdue_tasks),
            updated_at=project.updated_at,
        )

    @staticmethod
    def _fallback_brief(kpis: DashboardKpis, my_work: MyWorkSummary, documents: DashboardDocuments, projects: list[DashboardProjectItem], customers_available: bool) -> str:
        risk_count = sum(project.health in {"watch", "at_risk"} for project in projects)
        lines = [
            f"• {kpis.active_projects} active projects are in view; {risk_count} need closer attention.",
            f"• Your queue has {my_work.assigned} open assignments, including {my_work.overdue} overdue and {my_work.due_today} due today.",
            f"• Knowledge includes {kpis.notes} visible notes; documents are {documents.ready} ready, {documents.processing + documents.uploaded} processing or queued, and {documents.failed} failed.",
        ]
        if customers_available:
            lines.append(f"• The workspace currently tracks {kpis.customers or 0} customers and {kpis.employees} employees.")
        else:
            lines.append("• Customer insights are limited by your current role; employee and assigned-work insights remain available.")
        return "\n".join(lines)

    async def _brief(
        self,
        actor: User,
        kpis: DashboardKpis,
        my_work: MyWorkSummary,
        documents: DashboardDocuments,
        projects: list[DashboardProjectItem],
        customer_names: list[str],
        activity_summaries: list[str],
    ) -> ExecutiveBrief:
        generated_at = datetime.now(UTC)
        fallback = self._fallback_brief(kpis, my_work, documents, projects, actor.role != UserRole.EMPLOYEE)
        if self._chat_provider is None:
            return ExecutiveBrief(
                content=fallback,
                status="fallback",
                generated_at=generated_at,
                unavailable_reason="AI is not configured. Showing a live data summary instead.",
            )
        facts = {
            "date": generated_at.date().isoformat(),
            "kpis": kpis.model_dump(),
            "my_work": my_work.model_dump(mode="json"),
            "projects": [project.model_dump(mode="json") for project in projects],
            "documents": documents.model_dump(mode="json"),
            "recent_customers": customer_names,
            "important_activity": activity_summaries,
        }
        messages = [
            {
                "role": "system",
                "content": (
                    "You write a concise daily executive business brief from supplied authorized facts only. "
                    "Use four short bullet points covering project highlights, overdue work, important activity, "
                    "document processing, and customer updates when those facts exist. Do not invent facts, "
                    "people, trends, causes, or percentages. State when a category has no available data."
                ),
            },
            {"role": "user", "content": json.dumps(facts, default=str)},
        ]
        try:
            result = await self._chat_provider.complete(messages)
            content = result.text.strip()
            if not content:
                raise ValueError("AI returned an empty dashboard brief")
            return ExecutiveBrief(content=content, status="generated", generated_at=generated_at)
        except Exception:
            return ExecutiveBrief(
                content=fallback,
                status="fallback",
                generated_at=generated_at,
                unavailable_reason="The AI brief is temporarily unavailable. Showing a live data summary instead.",
            )

    async def overview(self, actor: User) -> DashboardOverviewResponse:
        """Assemble one role-aware dashboard snapshot and an optional AI brief."""
        today = datetime.now(UTC).date()
        kpis = DashboardKpis(**self._repository.kpis(actor))

        tasks, work_counts = self._repository.my_work(actor, today)
        my_work = MyWorkSummary(
            **work_counts,
            items=[
                DashboardTaskItem(
                    id=task.id,
                    project_id=task.project_id,
                    project_name=task.project.name,
                    title=task.title,
                    status=task.status,
                    priority=task.priority,
                    progress=task.progress,
                    due_date=task.due_date,
                )
                for task in tasks
            ],
        )

        recent_documents, document_counts = self._repository.documents(actor)
        documents = DashboardDocuments(
            **document_counts,
            recent=[
                DashboardDocumentItem(
                    id=document.id,
                    title=document.title,
                    filename=document.filename,
                    mime_type=document.mime_type,
                    size_bytes=document.size_bytes,
                    processing_status=document.processing_status,
                    updated_at=document.updated_at,
                )
                for document in recent_documents
            ],
        )
        projects = [self._project_item(project, today) for project in self._repository.projects(actor)]

        conversations, _ = self._conversations.list_company_conversations(actor.company_id, 0, 4, owner_id=actor.id)
        previews = self._conversations.get_last_message_previews(actor.company_id, [conversation.id for conversation in conversations])
        conversation_items = [
            ConversationResponse(**{
                **ConversationResponse.model_validate(conversation).model_dump(),
                "last_message_preview": previews.get(conversation.id),
            })
            for conversation in conversations
        ]

        added_customers, updated_customers, customer_activity = self._repository.customers(actor)
        customer_item = lambda customer: DashboardCustomerItem(
            id=customer.id,
            name=customer.name,
            status=customer.status,
            contact_name=customer.contact_name,
            created_at=customer.created_at,
            updated_at=customer.updated_at,
        )
        customers_available = actor.role != UserRole.EMPLOYEE
        customers = DashboardCustomers(
            available=customers_available,
            unavailable_reason=None if customers_available else "Customer insights are available to managers and administrators.",
            recently_added=[customer_item(customer) for customer in added_customers],
            recently_updated=[customer_item(customer) for customer in updated_customers],
            activity=[ActivityResponse.model_validate(item) for item in customer_activity],
        )

        updated_employees, workload_employees, employee_activity = self._repository.employees(actor)
        employee_item = lambda employee: DashboardEmployeeItem(
            id=employee.id,
            first_name=employee.first_name,
            last_name=employee.last_name,
            role=employee.role,
            job_title=employee.job_title,
            employment_status=employee.employment_status,
            assigned_task_count=sum(task.deleted_at is None and task.status != TaskStatus.DONE for task in employee.assigned_tasks),
            updated_at=employee.updated_at,
        )
        employees = DashboardEmployees(
            recently_updated=[employee_item(employee) for employee in updated_employees],
            workload=[employee_item(employee) for employee in workload_employees],
            activity_available=actor.role != UserRole.EMPLOYEE,
            activity=[ActivityResponse.model_validate(item) for item in employee_activity],
        )

        activity = self._repository.recent_activity(actor)
        brief = await self._brief(
            actor,
            kpis,
            my_work,
            documents,
            projects,
            [customer.name for customer in added_customers[:3]],
            [item.summary for item in activity],
        )
        return DashboardOverviewResponse(
            user=UserResponse.model_validate(actor),
            company=CompanyResponse.model_validate(actor.company),
            kpis=kpis,
            brief=brief,
            my_work=my_work,
            documents=documents,
            projects=projects,
            conversations=conversation_items,
            customers=customers,
            employees=employees,
        )
