from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field
from pydantic import AliasChoices

from app.schemas.common import ORMModel


class CitationPayload(BaseModel):
    marker: int
    doc_id: str
    title: str
    category: str = "document"
    excerpt: str
    chunk_id: str
    source_url: str | None = None
    page: int | None = None


class ChatMessageResponse(ORMModel):
    id: UUID
    thread_id: UUID
    role: str
    content: str
    citations: list[dict] = Field(default_factory=list)
    metadata: dict = Field(
        validation_alias=AliasChoices("message_metadata", "metadata"),
        default_factory=dict,
    )
    created_at: datetime


class ChatThreadResponse(ORMModel):
    id: UUID
    user_id: UUID
    title: str
    created_at: datetime
    updated_at: datetime


class ChatThreadCreate(BaseModel):
    title: str = "New chat"


class ChatStreamRequest(BaseModel):
    thread_id: UUID
    message: str
