import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, computed_field

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
    thumbnail_path: str | None = None

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


class DownloadCreate(BaseModel):
    url: str


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
    video_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
