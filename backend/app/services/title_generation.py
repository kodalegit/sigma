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
                            "You create brief, clear titles that summarize a conversation's opening user message.\n\n"
                            "Context: The chat is about a founder's private documents (pitch decks, policies, handbooks, finance sheets).\n"
                            "Answers should cite those documents; if info is missing, the assistant says it doesn't know and asks for the right file.\n\n"
                            "Guidelines:\n"
                            "- Use 3 to 7 words\n"
                            "- Capture the core task or question\n"
                            "- Keep wording simple and relevant\n"
                            "- Output ONLY the title, nothing else\n\n"
                            "Examples:\n"
                            "- 'Show me sales data' -> 'Sales Data Overview'\n"
                            "- 'How many users signed up last week?' -> 'Weekly User Signups'\n"
                            "- 'What is the total revenue?' -> 'Total Revenue Query'"
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
        title = title.strip("\"' ")
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
