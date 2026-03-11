from langchain_openai import OpenAIEmbeddings

from app.config import get_settings

_settings = get_settings()
_embeddings: OpenAIEmbeddings | None = None


def get_embeddings() -> OpenAIEmbeddings:
    global _embeddings
    if _embeddings is None:
        if not _settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured.")
        _embeddings = OpenAIEmbeddings(
            model=_settings.openai_embedding_model,
            api_key=_settings.openai_api_key,
        )
    return _embeddings
