import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.models import JobStatus, PlaylistKind


class VideoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    youtube_id: str
    title: str
    description: str
    youtube_url: str
    channel: str | None
    channel_id: str | None
    channel_avatar_url: str | None = None
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


class QualityOut(BaseModel):
    height: int
    size_bytes: int | None


class VideoFormatsOut(BaseModel):
    youtube_id: str
    title: str
    channel: str | None
    duration_seconds: int | None
    qualities: list[QualityOut]
    default_height: int | None
    video_id: uuid.UUID | None


class DownloadJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    youtube_id: str | None
    status: JobStatus
    progress: float
    speed: str | None
    eta: str | None
    error: str | None
    title: str | None
    max_height: int | None
    duration_seconds: int | None
    size_bytes: int | None
    video_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    thumbnail_path: str | None = Field(default=None, exclude=True)

    @computed_field
    @property
    def thumbnail_url(self) -> str | None:
        return f"/api/downloads/{self.id}/thumbnail" if self.thumbnail_path else None


class ChannelOut(BaseModel):
    id: str | None
    name: str
    handle: str | None = None
    subscribed: bool = False
    downloaded_count: int = 0
    avatar_url: str | None = None


class ChannelList(BaseModel):
    syncing: bool
    items: list[ChannelOut]


class RemoteVideoOut(BaseModel):
    youtube_id: str
    title: str
    duration_seconds: int | None
    view_count: int | None
    published_at: datetime | None
    thumbnail_url: str | None
    youtube_url: str
    video_id: uuid.UUID | None = None


class RemoteVideoPage(BaseModel):
    items: list[RemoteVideoOut]
    has_more: bool


class ChannelDetail(BaseModel):
    id: str
    known: bool
    refreshing: bool
    name: str
    handle: str | None
    description: str | None
    subscriber_count: int | None
    subscribed: bool
    avatar_url: str | None
    banner_url: str | None
    youtube_url: str
    online: bool
    latest: list[RemoteVideoOut]
    latest_fetched_at: datetime | None
    downloaded: list[VideoOut]


PIN_PATTERN = r"^\d{4}$"


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    avatar_url: str | None
    youtube_name: str | None


COOKIES_MAX_LENGTH = 200_000


class CookiesIn(BaseModel):
    cookies: str = Field(min_length=1, max_length=COOKIES_MAX_LENGTH)


class ProfileCreate(CookiesIn):
    name: str = Field(min_length=1, max_length=40)
    pin: str = Field(pattern=PIN_PATTERN)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("name cannot be blank")
        return value


class CookieStatusOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cookies_valid: bool | None
    cookies_checked_at: datetime | None


class PinIn(BaseModel):
    pin: str = Field(pattern=PIN_PATTERN)


class WatchIn(BaseModel):
    position: float = Field(ge=0)
    duration: float | None = Field(default=None, ge=0)


class WatchProgressOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    video_id: uuid.UUID
    position: float
    duration: float | None


class HistoryEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    video: VideoOut
    watched_at: datetime
    position: float
    duration: float | None


class HistoryPage(BaseModel):
    items: list[HistoryEntryOut]
    total: int


class PlaylistIn(BaseModel):
    name: str = Field(min_length=1, max_length=150)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("name cannot be blank")
        return value


class PlaylistOut(BaseModel):
    id: uuid.UUID
    name: str
    kind: PlaylistKind
    count: int
    thumbnail_url: str | None
    updated_at: datetime
    # Only when the list was asked about one video: whether that video is in it.
    contains: bool | None = None


class PlaylistItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    video: VideoOut
    added_at: datetime


class PlaylistDetail(PlaylistOut):
    items: list[PlaylistItemOut]
    duration_seconds: int
