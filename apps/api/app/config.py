from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

HHMM = r"^([01]\d|2[0-3]):[0-5]\d$"


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
    # "HH:MM" in the server's time: downloads only run between these hours, so they do not
    # fill the home network during the day. The same value for both lets them run at any hour.
    download_window_start: str = Field(default="01:00", pattern=HHMM)
    download_window_end: str = Field(default="08:00", pattern=HHMM)
    # Lets other apps on the server read /api/stats with the X-Service-Token header;
    # unset disables it.
    service_token: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
