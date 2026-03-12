from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.config import get_settings

settings = get_settings()


class TitleGenerationService:
    def __init__(self) -> None:
        self.model: ChatOpenAI | None = None

    def _get_model(self) -> ChatOpenAI:
        if self.model is None:
            if not settings.openai_api_key:
                raise RuntimeError("OPENAI_API_KEY is not configured.")
            self.model = ChatOpenAI(
                model=settings.openai_chat_model,
                api_key=settings.openai_api_key,
            )
        return self.model

    async def generate_title(self, message: str) -> str:
        fallback = self._fallback_title(message)
        try:
            response = await self._get_model().ainvoke(
                [
                    SystemMessage(
                        content=(
                            "Generate a concise chat thread title from the user's first message. "
                            "Use 3 to 7 words. Do not use quotes, punctuation at the end, or prefixes."
                        )
                    ),
                    HumanMessage(content=message.strip()),
                ]
            )
        except Exception:
            return fallback

        content = getattr(response, "content", "") or ""
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict):
                    text = item.get("text")
                    if isinstance(text, str):
                        parts.append(text)
                elif isinstance(item, str):
                    parts.append(item)
            content = " ".join(parts)

        title = " ".join(str(content).strip().replace("\n", " ").split())
        if not title:
            return fallback
        title = title.strip('"\' ')
        if len(title) > 72:
            title = title[:72].rstrip()
        return title or fallback

    def _fallback_title(self, message: str) -> str:
        words = message.strip().split()
        title = " ".join(words[:6]).strip()
        if not title:
            return "New chat"
        if len(words) > 6:
            title = f"{title}…"
        return title[:72]


title_generation_service = TitleGenerationService()
