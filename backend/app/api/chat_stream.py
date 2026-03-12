import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, get_current_user, get_session_dependency
from app.schemas.chat import ChatStreamRequest
from app.services.agent import agent_service
from app.services.chat_threads import (
    create_message,
    get_thread,
    list_messages,
    update_thread_title,
)
from app.services.stream_events import TitleEvent
from app.services.title_generation import title_generation_service
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found"
        )

    prior_messages = await list_messages(session, current_user.id, thread.id)
    history = [
        {"role": message.role, "content": message.content} for message in prior_messages
    ]
    await create_message(session, thread.id, "user", payload.message)

    async def event_stream():
        final_content = ""
        final_citations: list[dict] = []
        events_log: list[dict] = []

        if not prior_messages and thread.title == "New chat":
            generated_title = await title_generation_service.generate_title(
                payload.message
            )
            if generated_title and generated_title != thread.title:
                await update_thread_title(session, thread, generated_title)
                yield _sse_payload(TitleEvent(title=thread.title).to_dict())

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
            elif event_dict["type"] in {
                "reasoning",
                "tool_start",
                "tool_end",
                "citation",
            }:
                events_log.append(event_dict)
            yield _sse_payload(event_dict)

        if final_content:
            await create_message(
                session,
                thread.id,
                "assistant",
                final_content,
                citations=final_citations,
                metadata={"events": events_log} if events_log else {},
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
