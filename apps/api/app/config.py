from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://localtube:localtube@localhost:5442/localtube"
    media_root: Path = Path("./media")
    download_concurrency: int = 1
    worker_enabled: bool = True
    # YouTube asks for sign-in ("confirm you're not a bot") on some IPs. Either point to a
    # cookies.txt exported from a logged-in browser, or name a browser installed on this host.
    cookies_file: str | None = None
    cookies_from_browser: str | None = None
    default_max_height: int = 360


@lru_cache
def get_settings() -> Settings:
    return Settings()
