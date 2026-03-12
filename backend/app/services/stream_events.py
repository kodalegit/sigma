from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class StreamEvent:
    type: str

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type}


@dataclass(slots=True)
class TitleEvent(StreamEvent):
    title: str
    type: str = field(default="title", init=False)

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "title": self.title}


@dataclass(slots=True)
class ReasoningEvent(StreamEvent):
    content: str
    type: str = field(default="reasoning", init=False)

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "content": self.content}


@dataclass(slots=True)
class TokenEvent(StreamEvent):
    delta: str
    type: str = field(default="token", init=False)

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "delta": self.delta}


@dataclass(slots=True)
class ToolStartEvent(StreamEvent):
    tool: str
    tool_call_id: str
    input: dict[str, Any] | None = None
    type: str = field(default="tool_start", init=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "tool": self.tool,
            "tool_call_id": self.tool_call_id,
            "input": self.input,
        }


@dataclass(slots=True)
class ToolEndEvent(StreamEvent):
    tool: str
    tool_call_id: str
    summary: str = ""
    type: str = field(default="tool_end", init=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "tool": self.tool,
            "tool_call_id": self.tool_call_id,
            "summary": self.summary,
        }


@dataclass(slots=True)
class CitationEvent(StreamEvent):
    marker: int
    doc_id: str
    title: str
    excerpt: str
    chunk_id: str
    page: int | None = None
    category: str = "document"
    type: str = field(default="citation", init=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "marker": self.marker,
            "doc_id": self.doc_id,
            "title": self.title,
            "excerpt": self.excerpt,
            "chunk_id": self.chunk_id,
            "page": self.page,
            "category": self.category,
        }


@dataclass(slots=True)
class DoneEvent(StreamEvent):
    content: str
    citations: list[dict[str, Any]]
    type: str = field(default="done", init=False)

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "content": self.content, "citations": self.citations}


@dataclass(slots=True)
class ErrorEvent(StreamEvent):
    message: str
    code: str = "AGENT_ERROR"
    type: str = field(default="error", init=False)

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "message": self.message, "code": self.code}
