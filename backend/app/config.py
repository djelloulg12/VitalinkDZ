from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_ROOT / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "رعايتي DZ — نبض الرعاية المتصل"
    environment: str = "development"
    debug: bool = True

    # SQLite default (dev); postgres supported via DATABASE_URL env.
    database_url: str = f"sqlite+aiosqlite:///{_ROOT / 'data' / 'vitalink.db'}"
    storage_path: str = str(_ROOT / "storage")

    default_password: str = "demo123"
    jwt_secret: str = "vitalink-dz-dev-secret"
    secret_key: str = "vitalink-dz-dev-secret"
    access_token_expire_minutes: int = 60 * 24

    llm_provider: str = "mock"
    llm_model: str = "mock"
    openai_api_key: str = ""

    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()