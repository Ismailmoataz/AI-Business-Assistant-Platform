"""Tenant-safe executive dashboard API."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.ai.providers import AIProviderError, ChatProvider, ProviderFactory
from app.api.dependencies import get_current_user
from app.database.connection import get_db
from app.database.models.user import User
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.dashboard_repository import DashboardRepository
from app.schemas.dashboard import DashboardOverviewResponse
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def get_dashboard_chat_provider() -> ChatProvider | None:
    """Resolve the configured provider while allowing the dashboard to degrade safely."""
    try:
        return ProviderFactory.chat()
    except AIProviderError:
        return None


@router.get("/overview", response_model=DashboardOverviewResponse)
async def overview(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
    chat_provider: ChatProvider | None = Depends(get_dashboard_chat_provider),
) -> DashboardOverviewResponse:
    """Return the current user's bounded executive dashboard snapshot and daily AI brief."""
    service = DashboardService(DashboardRepository(session), ConversationRepository(session), chat_provider)
    return await service.overview(user)

