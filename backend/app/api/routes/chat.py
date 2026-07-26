"""Synchronous and streaming tenant-safe chat endpoints."""

import json
from collections.abc import AsyncIterator, Callable
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.api.routes.conversations import _conversation_page, _orchestrator, _service
from app.database.connection import get_db
from app.database.models.conversations import Message
from app.database.models.user import User
from app.schemas.chat import ChatMessageRequest, ChatMessageResponse, ChatRegenerateRequest
from app.schemas.conversations import ConversationPage
from app.services.chat_orchestrator_service import ChatOrchestratorService
from app.services.conversation_service import ConversationMessageNotFoundError, ConversationNotFoundError

router = APIRouter(prefix="/chat", tags=["Chat"])


async def _assistant_events(
    orchestrator: ChatOrchestratorService,
    user: User,
    conversation_id: UUID,
    prompt: str,
    persist: Callable[[str, dict[str, object]], Message],
) -> AsyncIterator[str]:
    """Stream tokens, then atomically persist and describe the completed response."""
    collected: list[str] = []
    try:
        prepared = await orchestrator.prepare_stream(user, user.company, conversation_id, prompt)
        async for token in prepared.tokens:
            collected.append(token)
            yield f"data: {json.dumps({'token': token})}\n\n"
        metadata = prepared.message_metadata()
        message = persist("".join(collected), metadata)
        completion = {"message_id": str(message.id), "citations": metadata["citations"]}
        yield f"event: complete\ndata: {json.dumps(completion)}\n\n"
    except Exception:
        yield "event: error\ndata: {\"detail\": \"Assistant stream failed\"}\n\n"


@router.post("/message", response_model=ChatMessageResponse)
async def message(payload: ChatMessageRequest, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> ChatMessageResponse:
    """Persist one user message and its synchronous assistant response."""
    service = _service(session)
    conversation = service.get_conversation(user, payload.conversation_id) if payload.conversation_id else service.create_conversation(user)
    service.add_user_message(user, conversation.id, payload.content)
    result = await _orchestrator(session).respond(user, user.company, conversation.id, payload.content)
    service.add_assistant_message(user, conversation.id, result.response, result.message_metadata())
    return ChatMessageResponse(
        conversation_id=conversation.id,
        response=result.response,
        source_documents=result.source_documents,
        citations=[citation.as_metadata() for citation in result.citations],
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
    )


@router.post("/stream")
async def stream(payload: ChatMessageRequest, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> StreamingResponse:
    """Stream SSE tokens and persist the assistant message only after successful completion."""
    service = _service(session)
    conversation = service.get_conversation(user, payload.conversation_id) if payload.conversation_id else service.create_conversation(user)
    service.add_user_message(user, conversation.id, payload.content)
    events = _assistant_events(
        _orchestrator(session),
        user,
        conversation.id,
        payload.content,
        lambda content, metadata: service.add_assistant_message(user, conversation.id, content, metadata),
    )
    return StreamingResponse(events, media_type="text/event-stream")


@router.post("/regenerate/stream")
async def regenerate_stream(payload: ChatRegenerateRequest, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> StreamingResponse:
    """Regenerate an owned assistant response in place after a successful stream."""
    service = _service(session)
    try:
        prompt = service.get_regeneration_prompt(user, payload.conversation_id, payload.assistant_message_id)
    except (ConversationNotFoundError, ConversationMessageNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    events = _assistant_events(
        _orchestrator(session),
        user,
        payload.conversation_id,
        prompt,
        lambda content, metadata: service.replace_assistant_message(
            user,
            payload.conversation_id,
            payload.assistant_message_id,
            content,
            metadata,
        ),
    )
    return StreamingResponse(events, media_type="text/event-stream")


@router.get("/conversations", response_model=ConversationPage)
def conversations(offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100), search: str | None = Query(None, max_length=500), user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> ConversationPage:
    """List authenticated-user conversations ordered by latest activity."""
    return _conversation_page(_service(session), user, offset, limit, search)
