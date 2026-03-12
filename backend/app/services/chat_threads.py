from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import ChatMessage, ChatThread


async def list_threads(session: AsyncSession, user_id: UUID) -> list[ChatThread]:
    stmt: Select[tuple[ChatThread]] = (
        select(ChatThread)
        .where(ChatThread.user_id == user_id)
        .order_by(ChatThread.updated_at.desc(), ChatThread.created_at.desc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def create_thread(session: AsyncSession, user_id: UUID, title: str) -> ChatThread:
    thread = ChatThread(user_id=user_id, title=title)
    session.add(thread)
    await session.commit()
    await session.refresh(thread)
    return thread


async def get_thread(
    session: AsyncSession, user_id: UUID, thread_id: UUID
) -> ChatThread | None:
    stmt: Select[tuple[ChatThread]] = select(ChatThread).where(
        ChatThread.id == thread_id,
        ChatThread.user_id == user_id,
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def list_messages(
    session: AsyncSession, user_id: UUID, thread_id: UUID
) -> list[ChatMessage]:
    stmt: Select[tuple[ChatMessage]] = (
        select(ChatMessage)
        .join(ChatThread, ChatThread.id == ChatMessage.thread_id)
        .where(ChatThread.id == thread_id, ChatThread.user_id == user_id)
        .order_by(ChatMessage.created_at.asc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def create_message(
    session: AsyncSession,
    thread_id: UUID,
    role: str,
    content: str,
    citations: list[dict] | None = None,
    metadata: dict | None = None,
) -> ChatMessage:
    thread = await session.get(ChatThread, thread_id)
    if thread is not None:
        thread.updated_at = func.now()
    message = ChatMessage(
        thread_id=thread_id,
        role=role,
        content=content,
        citations=citations or [],
        message_metadata=metadata or {},
    )
    session.add(message)
    await session.flush()
    await session.commit()
    await session.refresh(message)
    return message


async def update_thread_title(
    session: AsyncSession, thread: ChatThread, title: str
) -> ChatThread:
    thread.title = title
    thread.updated_at = func.now()
    await session.commit()
    await session.refresh(thread)
    return thread
