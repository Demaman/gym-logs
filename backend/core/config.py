import re

from pydantic import field_validator
from pydantic_settings import BaseSettings

_ASYNCPG_INCOMPATIBLE = re.compile(r"[?&](sslmode|channel_binding)=[^&]*")


class Settings(BaseSettings):
    database_url: str
    test_database_url: str = ""

    @field_validator("database_url", "test_database_url", mode="before")
    @classmethod
    def normalize_db_url(cls, v: str) -> str:
        if not v:
            return v
        if v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        # asyncpg doesn't accept sslmode/channel_binding as URL params;
        # SSL is handled via connect_args in database.py instead.
        v = _ASYNCPG_INCOMPATIBLE.sub("", v).rstrip("?").rstrip("&")
        return v
    redis_url: str

    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    ai_api_key: str = ""
    ai_model: str = "gemini-2.0-flash"
    # Leave empty to use OpenAI's default endpoint.
    # Gemini: https://generativelanguage.googleapis.com/v1beta/openai/
    # Groq:   https://api.groq.com/openai/v1
    ai_base_url: str = ""

    media_root: str = "/backend/media"
    media_base_url: str = ""

    model_config = {"env_file": ".env"}


settings = Settings()
