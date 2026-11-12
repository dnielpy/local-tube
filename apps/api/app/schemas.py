import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.models import JobStatus


class VideoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    youtube_id: str
    title: str
    description: str
    youtube_url: str
    channel: str | None
    duration_seconds: int | None
    file_size: int | None
    created_at: datetime
    thumbnail_path: str | None = Field(default=None, exclude=True)

    @computed_field
    @property
    def stream_url(self) -> str:
        return f"/api/videos/{self.id}/stream"

    @computed_field
    @property
    def thumbnail_url(self) -> str | None:
        return f"/api/videos/{self.id}/thumbnail" if self.thumbnail_path else None


class VideoPage(BaseModel):
    items: list[VideoOut]
    total: int


QUALITIES = (144, 240, 360, 480, 720, 1080, 1440, 2160)


class DownloadCreate(BaseModel):
    url: str
    max_height: int | None = None

    @field_validator("max_height")
    @classmethod
    def known_quality(cls, value: int | None) -> int | None:
        if value not in (None, *QUALITIES):
            raise ValueError(f"max_height must be one of {QUALITIES} or null")
        return value


class DownloadJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    status: JobStatus
    progress: float
    speed: str | None
    eta: str | None
    error: str | None
    title: str | None
    max_height: int | None
    video_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
