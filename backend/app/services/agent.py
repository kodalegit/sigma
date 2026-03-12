import json
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from langchain.agents import create_agent
from langchain.tools import ToolRuntime, tool
from langchain_openai import ChatOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.services.citations import CitationRegistry
from app.services.retrieval import search_user_documents
from app.services.stream_events import (
    CitationEvent,
    DoneEvent,
    ErrorEvent,
    ReasoningEvent,
    StreamEvent,
    TokenEvent,
    ToolEndEvent,
    ToolStartEvent,
)

settings = get_settings()


@dataclass(slots=True)
class HoroAgentContext:
    session: AsyncSession
    user_id: UUID
    retrieval_top_k: int
    citation_registry: CitationRegistry


class HoroAgentService:
    def __init__(self) -> None:
        self.model: ChatOpenAI | None = None

    def _build_system_prompt(self) -> str:
        return (
            "You are Horo, SIGMA's founder copilot. Use uploaded founder documents only. "
            "If the answer is not supported by retrieved documents, say 'I don't know' and suggest which document the founder should upload. "
            "Keep answers concise and useful. "
            "CITATION RULES: Every retrieved source already has a marker like [3]. Reuse the provided marker exactly. "
            "Do not renumber citations, invent citations, or cite unsupported claims. "
            "Place citations immediately after the supported claim. Reuse the same marker for repeated references to the same source. "
            "If a statement is not supported by the retrieved documents, state uncertainty instead of citing."
        )

    def _extract_reasoning_text(self, value: Any) -> str:
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, list):
            parts: list[str] = []
            for item in value:
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict):
                    text = item.get("text")
                    if isinstance(text, str):
                        parts.append(text)
            return " ".join(part.strip() for part in parts if part.strip())
        return ""

    def _build_search_tool(self):
        @tool
        async def search_user_documents_tool(
            query: str,
            runtime: ToolRuntime[HoroAgentContext],
        ) -> str:
            """Search the current founder's uploaded documents."""
            context = runtime.context
            retrieved = await search_user_documents(
                context.session,
                user_id=context.user_id,
                query=query,
                k=context.retrieval_top_k,
            )
            source_blocks: list[str] = []
            for item in retrieved:
                artifact = context.citation_registry.register(
                    doc_id=item.document_id,
                    title=item.title,
                    excerpt=item.content[:280],
                    chunk_id=item.chunk_id,
                    page=item.page_number,
                )
                header_parts = [f"[{artifact.marker}] {item.title}"]
                if item.page_number is not None:
                    header_parts.append(f"Page: {item.page_number}")
                header_parts.append("Excerpt:")
                source_blocks.append("\n".join(header_parts) + "\n" + item.content)
            if not source_blocks:
                return "No matching documents found."
            return "\n\n".join(source_blocks)

        return search_user_documents_tool

    def _get_model(self) -> ChatOpenAI:
        if self.model is None:
            if not settings.openai_api_key:
                raise RuntimeError("OPENAI_API_KEY is not configured.")
            self.model = ChatOpenAI(
                model=settings.openai_chat_model,
                api_key=settings.openai_api_key,
            )
        return self.model

    async def stream(
        self,
        *,
        session: AsyncSession,
        user_id: UUID,
        message: str,
        history: list[dict[str, str]],
    ) -> AsyncGenerator[StreamEvent, None]:
        citation_registry = CitationRegistry()
        emitted_citations: set[int] = set()
        final_content = ""
        runtime_context = HoroAgentContext(
            session=session,
            user_id=user_id,
            retrieval_top_k=settings.retrieval_top_k,
            citation_registry=citation_registry,
        )

        request_scoped_agent = create_agent(
            model=self._get_model(),
            tools=[self._build_search_tool()],
            system_prompt=self._build_system_prompt(),
            context_schema=HoroAgentContext,
        )

        messages = [*history, {"role": "user", "content": message}]

        try:
            async for chunk in request_scoped_agent.astream(
                {"messages": messages},
                context=runtime_context,
                stream_mode=["messages", "updates"],
                version="v2",
            ):
                chunk_type = chunk.get("type")
                data = chunk.get("data")
                if chunk_type == "messages":
                    token, metadata = data
                    if metadata.get("langgraph_node") != "model":
                        continue
                    token_text = getattr(token, "text", None)
                    if not isinstance(token_text, str) or not token_text:
                        token_text = getattr(token, "content", "") or ""
                    if token_text:
                        final_content += token_text
                        yield TokenEvent(delta=token_text)
                elif chunk_type == "updates":
                    for node_name, node_data in data.items():
                        node_messages = node_data.get("messages", [])
                        if not node_messages:
                            continue
                        latest = node_messages[-1]
                        if node_name == "model":
                            tool_calls = getattr(latest, "tool_calls", None) or []
                            reasoning_text = self._extract_reasoning_text(
                                getattr(latest, "content", "")
                            )
                            if reasoning_text and tool_calls:
                                yield ReasoningEvent(content=reasoning_text)
                            for tool_call in tool_calls:
                                yield ToolStartEvent(
                                    tool=tool_call.get("name", "search_user_documents"),
                                    tool_call_id=tool_call.get("id", ""),
                                    input=tool_call.get("args", {}),
                                )
                        elif node_name == "tools":
                            for tool_message in node_messages:
                                yield ToolEndEvent(
                                    tool=getattr(
                                        tool_message, "name", "search_user_documents"
                                    ),
                                    tool_call_id=getattr(
                                        tool_message, "tool_call_id", ""
                                    ),
                                    summary="Retrieved relevant document chunks.",
                                )
                            for artifact in citation_registry.list():
                                if artifact.marker in emitted_citations:
                                    continue
                                emitted_citations.add(artifact.marker)
                                payload = artifact.to_payload()
                                yield CitationEvent(
                                    marker=artifact.marker,
                                    doc_id=payload["doc_id"],
                                    title=artifact.title,
                                    excerpt=artifact.excerpt,
                                    chunk_id=payload["chunk_id"],
                                    page=artifact.page,
                                )
        except Exception as exc:
            yield ErrorEvent(message=str(exc)[:200])
            return

        yield DoneEvent(
            content=final_content,
            citations=[artifact.to_payload() for artifact in citation_registry.list()],
        )


agent_service = HoroAgentService()
