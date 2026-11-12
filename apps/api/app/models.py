import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    Text,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    youtube_id: Mapped[str] = mapped_column(Text, unique=True)
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, default="")
    file_path: Mapped[str] = mapped_column(Text)
    youtube_url: Mapped[str] = mapped_column(Text)
    thumbnail_path: Mapped[str | None] = mapped_column(Text)
    channel: Mapped[str | None] = mapped_column(Text)
    channel_id: Mapped[str | None] = mapped_column(Text, index=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    file_size: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    channel_info: Mapped["Channel | None"] = relationship(
        primaryjoin="foreign(Video.channel_id) == Channel.id", viewonly=True, lazy="selectin"
    )

    @property
    def channel_avatar_url(self) -> str | None:
        return self.channel_info.avatar_url if self.channel_info else None


class Channel(Base):
    __tablename__ = "channels"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    handle: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    subscriber_count: Mapped[int | None] = mapped_column(BigInteger)
    avatar_path: Mapped[str | None] = mapped_column(Text)
    avatar_source_url: Mapped[str | None] = mapped_column(Text)
    banner_path: Mapped[str | None] = mapped_column(Text)
    banner_source_url: Mapped[str | None] = mapped_column(Text)
    videos_fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    @property
    def avatar_url(self) -> str | None:
        if not self.avatar_path:
            return None
        return f"/api/channels/{self.id}/avatar?v={self.avatar_path.rsplit('-', 1)[-1]}"


class ChannelVideo(Base):
    __tablename__ = "channel_videos"

    youtube_id: Mapped[str] = mapped_column(Text, primary_key=True)
    channel_id: Mapped[str] = mapped_column(
        ForeignKey("channels.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(Text)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    view_count: Mapped[int | None] = mapped_column(BigInteger)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    thumbnail_path: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer)


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text)
    pin_hash: Mapped[str] = mapped_column(Text)
    avatar_path: Mapped[str | None] = mapped_column(Text)
    youtube_name: Mapped[str | None] = mapped_column(Text)
    signed_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    @property
    def avatar_url(self) -> str | None:
        if not self.avatar_path:
            return None
        return f"/api/profiles/{self.id}/avatar?v={self.avatar_path.rsplit('-', 1)[-1]}"


class ProfileVideo(Base):
    __tablename__ = "profile_videos"

    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True
    )
    video_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("videos.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProfileSubscription(Base):
    __tablename__ = "profile_subscriptions"

    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True
    )
    channel_id: Mapped[str] = mapped_column(
        ForeignKey("channels.id", ondelete="CASCADE"), primary_key=True
    )
    rank: Mapped[int] = mapped_column(Integer)


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    value: Mapped[str] = mapped_column(Text)


class JobStatus(enum.StrEnum):
    queued = "queued"
    downloading = "downloading"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class DownloadJob(Base):
    __tablename__ = "download_jobs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    url: Mapped[str] = mapped_column(Text)
    youtube_id: Mapped[str | None] = mapped_column(Text, index=True)
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, name="job_status"), default=JobStatus.queued, index=True
    )
    progress: Mapped[float] = mapped_column(Float, default=0)
    speed: Mapped[str | None] = mapped_column(Text)
    eta: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)
    title: Mapped[str | None] = mapped_column(Text)
    max_height: Mapped[int | None] = mapped_column(Integer)
    thumbnail_path: Mapped[str | None] = mapped_column(Text)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    video_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("videos.id", ondelete="SET NULL"))
    profile_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    video: Mapped[Video | None] = relationship(lazy="raise")
