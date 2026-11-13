from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import yt_dlp

from app.services.downloader import base_options, clean_error

# Streams that are live or not out yet cannot be downloaded as a video.
NOT_DOWNLOADABLE = {"is_live", "is_upcoming", "post_live"}


class YouTubeError(Exception):
    pass


@dataclass
class RemoteChannel:
    id: str
    name: str
    handle: str | None = None
    description: str | None = None
    subscriber_count: int | None = None
    avatar_url: str | None = None
    banner_url: str | None = None


@dataclass
class RemoteVideo:
    youtube_id: str
    title: str
    duration_seconds: int | None
    view_count: int | None
    published_at: datetime | None
    thumbnail_url: str
    live_status: str | None = None


@dataclass
class ChannelPage:
    channel: RemoteChannel
    videos: list[RemoteVideo] = field(default_factory=list)


def sized_image(url: str | None, size: str) -> str | None:
    if not url:
        return None
    if url.startswith("//"):
        url = "https:" + url
    return url.split("=")[0] + "=" + size


def video_thumbnail_url(youtube_id: str) -> str:
    return f"https://i.ytimg.com/vi/{youtube_id}/mqdefault.jpg"


def _thumbnail(thumbnails: list[dict[str, Any]] | None, thumbnail_id: str) -> str | None:
    for thumbnail in thumbnails or []:
        if thumbnail.get("id") == thumbnail_id:
            return thumbnail.get("url")
    return None


class YtDlpYouTubeClient:
    def _extract(self, url: str, cookies_file: str | None = None, **options: Any) -> dict[str, Any]:
        try:
            with yt_dlp.YoutubeDL({**base_options(cookies_file), **options}) as ydl:
                info = ydl.extract_info(url, download=False)
        except yt_dlp.utils.YoutubeDLError as exc:
            raise YouTubeError(clean_error(exc)) from exc
        if not info:
            raise YouTubeError(f"No data for {url}")
        return info

    def subscriptions(self, cookies_file: str | None = None) -> list[RemoteChannel]:
        info = self._extract(
            "https://www.youtube.com/feed/channels", cookies_file, extract_flat=True
        )
        channels = []
        for entry in info.get("entries") or []:
            channel_id = entry.get("channel_id") or entry.get("id")
            if not channel_id:
                continue
            thumbnails = entry.get("thumbnails") or []
            channels.append(
                RemoteChannel(
                    id=channel_id,
                    name=entry.get("channel") or entry.get("title") or channel_id,
                    handle=entry.get("uploader_id"),
                    description=entry.get("description"),
                    subscriber_count=entry.get("channel_follower_count"),
                    avatar_url=sized_image(
                        thumbnails[-1].get("url") if thumbnails else None, "s176"
                    ),
                )
            )
        return channels

    def channel(self, channel_id: str, limit: int = 10, start: int = 0) -> ChannelPage:
        info = self._extract(
            f"https://www.youtube.com/channel/{channel_id}/videos",
            extract_flat="in_playlist",
            playliststart=start + 1,
            playlistend=start + limit,
            extractor_args={"youtubetab": {"approximate_date": [""]}},
        )
        thumbnails = info.get("thumbnails")
        channel = RemoteChannel(
            id=info.get("channel_id") or channel_id,
            name=info.get("channel") or info.get("uploader") or channel_id,
            handle=info.get("uploader_id"),
            description=info.get("description"),
            subscriber_count=info.get("channel_follower_count"),
            avatar_url=sized_image(_thumbnail(thumbnails, "avatar_uncropped"), "s176"),
            banner_url=sized_image(_thumbnail(thumbnails, "banner_uncropped"), "w1280"),
        )
        videos = []
        for entry in (info.get("entries") or [])[:limit]:
            if not entry or not entry.get("id"):
                continue
            timestamp = entry.get("timestamp")
            videos.append(
                RemoteVideo(
                    youtube_id=entry["id"],
                    title=entry.get("title") or entry["id"],
                    duration_seconds=int(entry["duration"]) if entry.get("duration") else None,
                    view_count=entry.get("view_count"),
                    published_at=datetime.fromtimestamp(timestamp, UTC) if timestamp else None,
                    thumbnail_url=video_thumbnail_url(entry["id"]),
                    live_status=entry.get("live_status"),
                )
            )
        return ChannelPage(channel=channel, videos=videos)
