"""JWT-protected conversation creation, listing, and history endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database.connection import get_db
from app.database.models.user import User
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.embedding_repository import DocumentEmbeddingRepository
from app.ai.providers import ProviderFactory
from app.schemas.conversations import ConversationCreateRequest, ConversationDetailResponse, ConversationMessageCreateRequest, ConversationMessageResponse, ConversationPage, ConversationResponse, ConversationUpdateRequest, MessageResponse
from app.services.chat_orchestrator_service import ChatOrchestratorService
from app.services.context_builder import ContextBuilder
from app.services.embedding_service import EmbeddingService
from app.services.rag_retrieval_service import RAGRetrievalService
from app.services.vector_search_service import VectorSearchService
from app.services.conversation_service import ConversationNotFoundError, ConversationService

router = APIRouter(prefix="/conversations", tags=["Conversations"])


def _service(session: Session) -> ConversationService:
    """Create a request-scoped conversation service."""
    return ConversationService(ConversationRepository(session))


def _orchestrator(session: Session) -> ChatOrchestratorService:
    """Compose existing retrieval/context services with the configured chat provider."""
    embeddings = EmbeddingService()
    retrieval = RAGRetrievalService(embeddings, VectorSearchService(DocumentEmbeddingRepository(session)))
    return ChatOrchestratorService(retrieval, ContextBuilder(), ProviderFactory.chat())


def _conversation_page(service: ConversationService, user: User, offset: int, limit: int, search: str | None = None) -> ConversationPage:
    """Serialize one owned conversation page with bounded last-message previews."""
    items, total = service.list_conversations(user, offset, limit, search)
    previews = service.get_last_message_previews(user, items)
    return ConversationPage(
        items=[
            ConversationResponse(**{
                **ConversationResponse.model_validate(item).model_dump(),
                "last_message_preview": previews.get(item.id),
            })
            for item in items
        ],
        page={"offset": offset, "limit": limit, "total": total},
    )


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(payload: ConversationCreateRequest, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> ConversationResponse:
    """Create a conversation owned by the authenticated user in their tenant."""
    return ConversationResponse.model_validate(_service(session).create_conversation(user, payload.title))


@router.get("", response_model=ConversationPage)
def list_conversations(offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100), search: str | None = Query(None, max_length=500), user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> ConversationPage:
    """List the authenticated user's tenant-isolated conversations by latest activity."""
    return _conversation_page(_service(session), user, offset, limit, search)


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(conversation_id: UUID, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> ConversationDetailResponse:
    """Return an owned conversation with chronological message history."""
    service = _service(session)
    try:
        conversation = service.get_conversation(user, conversation_id)
        messages = service.get_conversation_history(user, conversation_id)
        metadata = ConversationResponse.model_validate(conversation).model_dump()
        metadata["last_message_preview"] = messages[-1].content.strip()[:180] if messages else None
        return ConversationDetailResponse(**metadata, messages=messages)
    except ConversationNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/{conversation_id}", response_model=ConversationResponse)
def rename_conversation(conversation_id: UUID, payload: ConversationUpdateRequest, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> ConversationResponse:
    """Rename one owned conversation without exposing cross-tenant existence."""
    service = _service(session)
    try:
        conversation = service.rename_conversation(user, conversation_id, payload.title)
        previews = service.get_last_message_previews(user, [conversation])
        return ConversationResponse(**{
            **ConversationResponse.model_validate(conversation).model_dump(),
            "last_message_preview": previews.get(conversation.id),
        })
    except ConversationNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(conversation_id: UUID, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> Response:
    """Permanently delete one owned conversation and its message history."""
    try:
        _service(session).delete_conversation(user, conversation_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except ConversationNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{conversation_id}/messages", response_model=ConversationMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(conversation_id: UUID, payload: ConversationMessageCreateRequest, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> ConversationMessageResponse:
    """Persist a user message, generate one reply, and persist the assistant response."""
    service = _service(session)
    try:
        conversation = service.get_conversation(user, conversation_id)
        service.add_user_message(user, conversation_id, payload.content)
        result = await _orchestrator(session).respond(user, user.company, conversation_id, payload.content)
        assistant = service.add_assistant_message(user, conversation_id, result.response, result.message_metadata())
        return ConversationMessageResponse(
            conversation=ConversationResponse.model_validate(conversation),
            message=MessageResponse.model_validate(assistant),
            source_documents=result.source_documents,
            citations=[citation.as_metadata() for citation in result.citations],
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
        )
    except ConversationNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
