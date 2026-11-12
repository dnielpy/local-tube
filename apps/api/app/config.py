from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://localtube:localtube@localhost:5432/localtube"
    media_root: Path = Path("./media")
    download_concurrency: int = 1
    worker_enabled: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
