from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    test_database_url: str = ""
    redis_url: str

    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

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
