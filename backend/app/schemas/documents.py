from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import ORMModel


class DocumentResponse(ORMModel):
    id: UUID
    user_id: UUID
    filename: str
    title: str
    mime_type: str
    status: str
    created_at: datetime


class DocumentUploadResponse(BaseModel):
    document: DocumentResponse
    chunks_indexed: int
