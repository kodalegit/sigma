import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, get_current_user, get_session_dependency
from app.schemas.chat import ChatStreamRequest
from app.services.agent import agent_service
from app.services.chat_threads import create_message, get_thread, list_messages
from app.services.users import ensure_user

router = APIRouter(prefix="/chat", tags=["chat"])


def _sse_payload(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


@router.post("/stream")
async def stream_chat(
    payload: ChatStreamRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session_dependency),
) -> StreamingResponse:
    await ensure_user(session, current_user.id, current_user.email)
    thread = await get_thread(session, current_user.id, payload.thread_id)
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    prior_messages = await list_messages(session, current_user.id, thread.id)
    history = [{"role": message.role, "content": message.content} for message in prior_messages]
    await create_message(session, thread.id, "user", payload.message)

    async def event_stream():
        final_content = ""
        final_citations: list[dict] = []
        async for event in agent_service.stream(
            session=session,
            user_id=current_user.id,
            message=payload.message,
            history=history,
        ):
            event_dict = event.to_dict()
            if event_dict["type"] == "token":
                final_content += event_dict["delta"]
            elif event_dict["type"] == "done":
                final_content = event_dict["content"]
                final_citations = event_dict["citations"]
            yield _sse_payload(event_dict)

        if final_content:
            await create_message(
                session,
                thread.id,
                "assistant",
                final_content,
                citations=final_citations,
            )

    return StreamingResponse(event_stream(), media_type="text/event-stream")
