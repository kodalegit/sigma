from dataclasses import asdict, dataclass
from typing import Any
from uuid import UUID


@dataclass(slots=True)
class CitationArtifact:
    marker: int
    doc_id: UUID
    title: str
    excerpt: str
    chunk_id: UUID
    page: int | None = None
    category: str = "document"

    def to_payload(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["doc_id"] = str(self.doc_id)
        payload["chunk_id"] = str(self.chunk_id)
        return payload


class CitationRegistry:
    def __init__(self) -> None:
        self._artifacts: list[CitationArtifact] = []
        self._by_chunk_id: dict[UUID, CitationArtifact] = {}

    def register(
        self,
        *,
        doc_id: UUID,
        title: str,
        excerpt: str,
        chunk_id: UUID,
        page: int | None,
    ) -> CitationArtifact:
        existing = self._by_chunk_id.get(chunk_id)
        if existing is not None:
            return existing

        artifact = CitationArtifact(
            marker=len(self._artifacts) + 1,
            doc_id=doc_id,
            title=title,
            excerpt=excerpt,
            chunk_id=chunk_id,
            page=page,
        )
        self._artifacts.append(artifact)
        self._by_chunk_id[chunk_id] = artifact
        return artifact

    def list(self) -> list[CitationArtifact]:
        return list(self._artifacts)
