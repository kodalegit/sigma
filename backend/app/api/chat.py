from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.api.dependencies import CurrentUser, get_current_user, get_session_dependency
from app.schemas.chat import ChatMessageResponse, ChatThreadCreate, ChatThreadResponse
from app.services.chat_threads import (
    create_thread,
    delete_thread,
    get_thread,
    list_messages,
    list_threads,
)
from app.services.users import ensure_user

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/threads", response_model=list[ChatThreadResponse])
async def get_threads(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session_dependency),
) -> list[ChatThreadResponse]:
    await ensure_user(session, current_user.id, current_user.email)
    threads = await list_threads(session, current_user.id)
    return [ChatThreadResponse.model_validate(thread) for thread in threads]


@router.post(
    "/threads",
    response_model=ChatThreadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def post_thread(
    payload: ChatThreadCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session_dependency),
) -> ChatThreadResponse:
    await ensure_user(session, current_user.id, current_user.email)
    thread = await create_thread(session, current_user.id, payload.title)
    return ChatThreadResponse.model_validate(thread)


@router.get("/threads/{thread_id}/messages", response_model=list[ChatMessageResponse])
async def get_thread_messages(
    thread_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session_dependency),
) -> list[ChatMessageResponse]:
    thread = await get_thread(session, current_user.id, thread_id)
    if thread is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found"
        )

    messages = await list_messages(session, current_user.id, thread.id)
    return [ChatMessageResponse.model_validate(message) for message in messages]


@router.delete("/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_thread_endpoint(
    thread_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session_dependency),
) -> None:
    deleted = await delete_thread(session, current_user.id, thread_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found"
        )
