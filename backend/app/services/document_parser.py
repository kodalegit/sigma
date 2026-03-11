from dataclasses import dataclass
from pathlib import Path

import fitz


@dataclass(slots=True)
class ParsedPage:
    page_number: int | None
    text: str


async def parse_document(filename: str, content: bytes, mime_type: str | None) -> list[ParsedPage]:
    suffix = Path(filename).suffix.lower()
    if mime_type == "application/pdf" or suffix == ".pdf":
        return _parse_pdf(content)
    if mime_type in {"text/plain", "text/markdown"} or suffix in {".txt", ".md"}:
        text = content.decode("utf-8", errors="ignore")
        return [ParsedPage(page_number=None, text=text)]
    raise ValueError("Unsupported file type. Please upload a PDF, TXT, or MD file.")


def _parse_pdf(content: bytes) -> list[ParsedPage]:
    pages: list[ParsedPage] = []
    with fitz.open(stream=content, filetype="pdf") as document:
        for index, page in enumerate(document, start=1):
            pages.append(ParsedPage(page_number=index, text=page.get_text("text")))
    return pages
