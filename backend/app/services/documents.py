from uuid import UUID

from sqlalchemy import Select, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document


async def list_documents(session: AsyncSession, user_id: UUID) -> list[Document]:
    stmt: Select[tuple[Document]] = (
        select(Document)
        .where(Document.user_id == user_id)
        .order_by(Document.created_at.desc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def delete_document(
    session: AsyncSession, user_id: UUID, document_id: UUID
) -> bool:
    stmt = (
        delete(Document)
        .where(Document.id == document_id, Document.user_id == user_id)
        .returning(Document.id)
    )
    result = await session.execute(stmt)
    deleted_id = result.scalar_one_or_none()
    await session.commit()
    return deleted_id is not None


async def create_document(
    session: AsyncSession,
    user_id: UUID,
    filename: str,
    title: str,
    mime_type: str,
    status: str = "uploaded",
) -> Document:
    document = Document(
        user_id=user_id,
        filename=filename,
        title=title,
        mime_type=mime_type,
        status=status,
    )
    session.add(document)
    await session.commit()
    await session.refresh(document)
    return document


async def update_document_status(
    session: AsyncSession, document: Document, status: str
) -> Document:
    document.status = status
    await session.commit()
    await session.refresh(document)
    return document


async def get_document(
    session: AsyncSession, user_id: UUID, document_id: UUID
) -> Document | None:
    stmt: Select[tuple[Document]] = select(Document).where(
        Document.id == document_id,
        Document.user_id == user_id,
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()
