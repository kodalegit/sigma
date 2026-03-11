from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, get_current_user, get_session_dependency
from app.schemas.documents import DocumentResponse, DocumentUploadResponse
from app.services.documents import create_document, delete_document, list_documents
from app.services.ingestion import ingest_document
from app.services.users import ensure_user
from uuid import UUID

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[DocumentResponse])
async def get_documents(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session_dependency),
) -> list[DocumentResponse]:
    await ensure_user(session, current_user.id, current_user.email)
    documents = await list_documents(session, current_user.id)
    return [DocumentResponse.model_validate(document) for document in documents]


@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session_dependency),
) -> DocumentUploadResponse:
    await ensure_user(session, current_user.id, current_user.email)
    file_bytes = await file.read()
    document = await create_document(
        session,
        user_id=current_user.id,
        filename=file.filename or "upload",
        title=file.filename or "Untitled document",
        mime_type=file.content_type or "application/octet-stream",
        status="processing",
    )
    chunks_indexed = await ingest_document(
        session,
        user_id=current_user.id,
        document=document,
        filename=file.filename or "upload",
        mime_type=file.content_type,
        content=file_bytes,
    )
    return DocumentUploadResponse(
        document=DocumentResponse.model_validate(document),
        chunks_indexed=chunks_indexed,
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document_endpoint(
    document_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session_dependency),
) -> None:
    await ensure_user(session, current_user.id, current_user.email)
    deleted = await delete_document(session, current_user.id, document_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )
