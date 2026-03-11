from uuid import UUID

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.document import Document, DocumentChunk
from app.services.document_parser import parse_document
from app.services.embeddings import get_embeddings
from app.services.redaction import mask_sensitive_ids
from app.services.text_chunks import split_text

settings = get_settings()


async def ingest_document(
    session: AsyncSession,
    *,
    user_id: UUID,
    document: Document,
    filename: str,
    mime_type: str | None,
    content: bytes,
) -> int:
    parsed_pages = await parse_document(filename, content, mime_type)

    rows: list[tuple[int | None, int | None, str, str]] = []
    for page in parsed_pages:
        for chunk in split_text(
            page.text,
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        ):
            masked = mask_sensitive_ids(chunk.content)
            rows.append((page.page_number, chunk.start_index, chunk.content, masked))

    if not rows:
        document.status = "failed"
        await session.commit()
        return 0

    embeddings = await get_embeddings().aembed_documents([row[3] for row in rows])

    await session.execute(
        delete(DocumentChunk).where(DocumentChunk.document_id == document.id)
    )

    session.add_all(
        [
            DocumentChunk(
                document_id=document.id,
                user_id=user_id,
                chunk_index=index,
                page_number=page_number,
                content=content_value,
                content_masked=masked_value,
                chunk_metadata={
                    "source": document.title,
                    "start_index": start_index,
                },
                embedding=embedding,
            )
            for index, (
                (page_number, start_index, content_value, masked_value),
                embedding,
            ) in enumerate(zip(rows, embeddings, strict=False))
        ]
    )
    document.status = "ready"
    await session.commit()
    return len(rows)
