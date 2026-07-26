"""Authorized folder, document, upload, download, version, and search endpoints."""

from collections.abc import Iterator
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Response, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.config.settings import settings
from app.database.models.enums import DocumentVisibility
from app.database.models.user import User
from app.database.connection import get_db
from app.schemas.documents import DocumentPage, DocumentResponse, DocumentUpdateRequest, DocumentVersionResponse, FolderCreateRequest, FolderResponse, FolderUpdateRequest, SignedUrlResponse
from app.services.business_service import BusinessConflictError, BusinessNotFoundError, BusinessPermissionError, BusinessValidationError
from app.services.document_service import DocumentService
from app.services.document_ingestion_service import process_document_in_background

folders_router = APIRouter(prefix="/folders", tags=["Folders"])
documents_router = APIRouter(prefix="/documents", tags=["Documents"])


def _stream_storage_object(result: object) -> Iterator[bytes]:
    """Yield a MinIO response and always release its pooled HTTP connection."""
    try:
        yield from result.stream(32 * 1024)  # type: ignore[attr-defined]
    finally:
        result.close()  # type: ignore[attr-defined]
        result.release_conn()  # type: ignore[attr-defined]


def svc(session: Session) -> DocumentService:
    """Create a request-scoped document service."""
    return DocumentService(session)


def fail(exc: Exception) -> None:
    """Translate document domain errors without exposing storage details."""
    codes = {BusinessNotFoundError: 404, BusinessPermissionError: 403, BusinessConflictError: 409, BusinessValidationError: 400}
    for kind, code in codes.items():
        if isinstance(exc, kind): raise HTTPException(code, str(exc)) from exc
    raise exc


@folders_router.post("", response_model=FolderResponse, status_code=201)
def create_folder(payload: FolderCreateRequest, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> FolderResponse:
    """Create a nested folder with a tenant-scoped visibility policy."""
    try: return FolderResponse.model_validate(svc(session).create_folder(user, **payload.model_dump()))
    except Exception as exc: fail(exc)


@folders_router.get("", response_model=list[FolderResponse])
def list_folders(user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> list[FolderResponse]:
    """List folders visible under the caller's tenant and visibility scope."""
    return [FolderResponse.model_validate(item) for item in svc(session).list_folders(user)]


@folders_router.patch("/{folder_id}", response_model=FolderResponse)
def update_folder(folder_id: UUID, payload: FolderUpdateRequest, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> FolderResponse:
    """Rename, move, or change access to an authorized folder."""
    try: return FolderResponse.model_validate(svc(session).update_folder(user, folder_id, payload.model_dump(exclude_unset=True)))
    except Exception as exc: fail(exc)


@documents_router.post("/upload", response_model=DocumentResponse, status_code=201)
async def upload_document(background_tasks: BackgroundTasks, file: UploadFile = File(...), title: str = Form(..., min_length=1, max_length=250), description: str | None = Form(None), folder_id: UUID | None = Form(None), department_id: UUID | None = Form(None), customer_id: UUID | None = Form(None), visibility: DocumentVisibility = Form(DocumentVisibility.PRIVATE), tag_ids: list[UUID] = Form(default=[]), user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> DocumentResponse:
    """Upload a supported file and schedule tenant-scoped background ingestion."""
    try:
        document = await svc(session).upload(user, file, title, description, folder_id, department_id, visibility, tag_ids, customer_id)
        background_tasks.add_task(process_document_in_background, document.id, document.company_id)
        return DocumentResponse.model_validate(document)
    except Exception as exc: fail(exc)


@documents_router.get("", response_model=DocumentPage)
def search_documents(offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100), q: str | None = Query(None, max_length=500), folder_id: UUID | None = None, owner_id: UUID | None = None, customer_id: UUID | None = None, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> dict:
    """Search accessible document metadata, extracted text, tags, and folders."""
    try:
        items, total = svc(session).list_documents(user, offset, limit, q, folder_id, owner_id, customer_id)
        return {"items": [DocumentResponse.model_validate(item) for item in items], "page": {"offset": offset, "limit": limit, "total": total}}
    except Exception as exc: fail(exc)


@documents_router.get("/favorites/list", response_model=list[DocumentResponse])
def favorites(user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> list[DocumentResponse]:
    """List the caller's accessible favorite documents."""
    return [DocumentResponse.model_validate(item) for item in svc(session).favorites(user)]


@documents_router.get("/recent/list", response_model=list[DocumentResponse])
def recents(user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> list[DocumentResponse]:
    """List the caller's recently downloaded documents."""
    return [DocumentResponse.model_validate(item) for item in svc(session).recents(user)]


@documents_router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: UUID, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> DocumentResponse:
    """Return authorized document metadata and update the recent-document list."""
    try: return DocumentResponse.model_validate(svc(session)._document(user, document_id))
    except Exception as exc: fail(exc)


@documents_router.patch("/{document_id}", response_model=DocumentResponse)
def update_document(document_id: UUID, payload: DocumentUpdateRequest, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> DocumentResponse:
    """Rename, move, tag, archive, or change document permissions."""
    try: return DocumentResponse.model_validate(svc(session).update(user, document_id, payload.model_dump(exclude_unset=True)))
    except Exception as exc: fail(exc)


@documents_router.post("/{document_id}/replace", response_model=DocumentResponse)
async def replace_document(document_id: UUID, file: UploadFile = File(...), user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> DocumentResponse:
    """Upload an immutable next version of an authorized document."""
    try: return DocumentResponse.model_validate(await svc(session).replace(user, document_id, file))
    except Exception as exc: fail(exc)


@documents_router.get("/{document_id}/versions", response_model=list[DocumentVersionResponse])
def versions(document_id: UUID, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> list[DocumentVersionResponse]:
    """Return metadata for all authorized document versions."""
    try: return [DocumentVersionResponse.model_validate(item) for item in svc(session)._document(user, document_id).versions]
    except Exception as exc: fail(exc)


@documents_router.get("/{document_id}/download")
def download(document_id: UUID, version: int | None = None, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> StreamingResponse:
    """Stream an authorized version through the backend without public bucket access."""
    try:
        doc, selected = svc(session).record_download(user, document_id, version); result = svc(session).storage.get_object(settings.minio_documents_bucket, selected.object_key)
        return StreamingResponse(_stream_storage_object(result), media_type=selected.mime_type, headers={"Content-Disposition": f'attachment; filename="{selected.filename}"'})
    except Exception as exc: fail(exc)


@documents_router.get("/{document_id}/signed-url", response_model=SignedUrlResponse)
def signed_url(document_id: UUID, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> SignedUrlResponse:
    """Issue a short-lived URL only after backend authorization of the current version."""
    try:
        _, selected = svc(session).record_download(user, document_id); url = svc(session).storage.presigned_get_object(settings.minio_documents_bucket, selected.object_key, expires=__import__('datetime').timedelta(seconds=settings.document_signed_url_expiry_seconds)); return SignedUrlResponse(url=url, expires_in_seconds=settings.document_signed_url_expiry_seconds)
    except Exception as exc: fail(exc)


@documents_router.post("/{document_id}/favorite", status_code=204)
def add_favorite(document_id: UUID, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> Response:
    """Add an authorized document to the caller's favorites."""
    try: svc(session).favorite(user, document_id, True); return Response(status_code=204)
    except Exception as exc: fail(exc)


@documents_router.delete("/{document_id}/favorite", status_code=204)
def remove_favorite(document_id: UUID, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> Response:
    """Remove a document from the caller's favorites."""
    try: svc(session).favorite(user, document_id, False); return Response(status_code=204)
    except Exception as exc: fail(exc)


@documents_router.delete("/{document_id}", status_code=204)
def delete_document(document_id: UUID, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> Response:
    """Soft-delete an authorized document while preserving versions and audit history."""
    try: svc(session).soft_delete(user, document_id); return Response(status_code=204)
    except Exception as exc: fail(exc)


@documents_router.post("/{document_id}/restore", response_model=DocumentResponse)
def restore_document(document_id: UUID, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> DocumentResponse:
    """Restore an authorized soft-deleted document."""
    try: return DocumentResponse.model_validate(svc(session).soft_delete(user, document_id, True))
    except Exception as exc: fail(exc)
