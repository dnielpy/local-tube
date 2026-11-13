from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://localtube:localtube@localhost:5442/localtube"
    media_root: Path = Path("./media")
    download_concurrency: int = 1
    worker_enabled: bool = True
    profiles_root: Path = Path("./config/profiles")
    default_max_height: int = 360
    connectivity_check: bool = True
    connectivity_url: str = "https://www.youtube.com/generate_204"
    connectivity_interval: float = 60
    # Lets other apps on the server read /api/stats with the X-Service-Token header;
    # unset disables it.
    service_token: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
