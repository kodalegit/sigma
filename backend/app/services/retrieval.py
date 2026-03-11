from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.document import Document, DocumentChunk
from app.services.embeddings import get_embeddings

settings = get_settings()


@dataclass(slots=True)
class RetrievedChunk:
    chunk_id: UUID
    document_id: UUID
    title: str
    page_number: int | None
    content: str
    score: float | None


async def search_user_documents(
    session: AsyncSession,
    *,
    user_id: UUID,
    query: str,
    k: int | None = None,
) -> list[RetrievedChunk]:
    embedding = await get_embeddings().aembed_query(query)
    limit = k or settings.retrieval_top_k
    distance = DocumentChunk.embedding.cosine_distance(embedding).label("distance")

    stmt: Select[tuple[DocumentChunk, Document, float]] = (
        select(DocumentChunk, Document, distance)
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(
            DocumentChunk.user_id == user_id,
            Document.status == "ready",
        )
        .order_by(distance)
        .limit(limit)
    )
    result = await session.execute(stmt)

    return [
        RetrievedChunk(
            chunk_id=chunk.id,
            document_id=document.id,
            title=document.title,
            page_number=chunk.page_number,
            content=chunk.content_masked,
            score=max(0.0, 1.0 - float(distance_value)),
        )
        for chunk, document, distance_value in result.all()
    ]
