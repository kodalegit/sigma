from dataclasses import dataclass
from langchain_text_splitters import RecursiveCharacterTextSplitter


@dataclass(slots=True)
class TextChunk:
    chunk_index: int
    content: str
    start_index: int | None


def split_text(text: str, *, chunk_size: int, chunk_overlap: int) -> list[TextChunk]:
    cleaned = text.replace("\x00", "").strip()
    if not cleaned:
        return []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        add_start_index=True,
    )
    documents = splitter.create_documents([cleaned])
    return [
        TextChunk(
            chunk_index=index,
            content=document.page_content,
            start_index=document.metadata.get("start_index"),
        )
        for index, document in enumerate(documents)
    ]
