from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SIGMA Horo API"
    api_prefix: str = "/api"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/sigma"
    jwt_secret_key: str = "sigma-demo-secret-key-SuPeRSeCrEtKeY"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 60 * 12
    openai_api_key: str | None = None
    openai_chat_model: str = "gpt-5-nano"
    openai_embedding_model: str = "text-embedding-3-small"
    retrieval_top_k: int = 5
    chunk_size: int = 1000
    chunk_overlap: int = 200

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    def _normalize_async_database_url(self) -> tuple[str, dict[str, bool]]:
        database_url = self.database_url
        if database_url.startswith("postgres://"):
            database_url = database_url.replace(
                "postgres://", "postgresql+asyncpg://", 1
            )
        elif database_url.startswith("postgresql://"):
            database_url = database_url.replace(
                "postgresql://", "postgresql+asyncpg://", 1
            )
        elif database_url.startswith("postgresql+psycopg2://"):
            database_url = database_url.replace(
                "postgresql+psycopg2://", "postgresql+asyncpg://", 1
            )
        elif database_url.startswith("postgresql+psycopg://"):
            database_url = database_url.replace(
                "postgresql+psycopg://", "postgresql+asyncpg://", 1
            )

        parsed = urlsplit(database_url)
        query_params = dict(parse_qsl(parsed.query, keep_blank_values=True))
        connect_args: dict[str, bool] = {}

        sslmode = query_params.pop("sslmode", None)
        query_params.pop("channel_binding", None)
        if sslmode is not None:
            normalized_sslmode = sslmode.lower()
            if normalized_sslmode == "disable":
                connect_args["ssl"] = False
            elif normalized_sslmode in {
                "allow",
                "prefer",
                "require",
                "verify-ca",
                "verify-full",
            }:
                connect_args["ssl"] = True

        normalized_url = urlunsplit(
            (
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                urlencode(query_params),
                parsed.fragment,
            )
        )
        return normalized_url, connect_args

    @property
    def async_database_url(self) -> str:
        return self._normalize_async_database_url()[0]

    @property
    def async_database_connect_args(self) -> dict[str, bool]:
        return self._normalize_async_database_url()[1]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
