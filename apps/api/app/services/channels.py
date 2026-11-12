import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Protocol

from sqlalchemy import delete, select, update

from app.db import SessionLocal
from app.media import media_path
from app.models import Channel, ChannelVideo, Video
from app.services.connectivity import connectivity
from app.services.image_cache import ImageFetcher, cache_image, http_fetch, remove_cached
from app.services.youtube import ChannelPage, RemoteChannel, YouTubeError
from app.settings_store import read_setting, write_setting

logger = logging.getLogger(__name__)

SUBSCRIPTIONS_TTL = timedelta(hours=24)
CHANNEL_TTL = timedelta(hours=6)
AVATAR_CONCURRENCY = 8
PAGE_SIZE = 10
MEDIA_RETRY = timedelta(hours=1)
MEDIA_SWEEP_INTERVAL = 600
SUBSCRIPTIONS_SYNCED_KEY = "subscriptions_synced_at"


class YouTubeClient(Protocol):
    def subscriptions(self) -> list[RemoteChannel]: ...

    def channel(self, channel_id: str, limit: int = 10, start: int = 0) -> ChannelPage: ...


def _now() -> datetime:
    return datetime.now(UTC)


class ChannelService:
    def __init__(self, client: YouTubeClient, fetch: ImageFetcher = http_fetch) -> None:
        self.client = client
        self.fetch = fetch
        self._locks: dict[str, asyncio.Lock] = {}
        self._running: dict[str, asyncio.Task[bool]] = {}

    def _lock(self, key: str) -> asyncio.Lock:
        return self._locks.setdefault(key, asyncio.Lock())

    def is_running(self, key: str) -> bool:
        task = self._running.get(key)
        return task is not None and not task.done()

    def _spawn(self, key: str, coroutine) -> bool:
        if self.is_running(key):
            coroutine.close()
            return True
        self._running[key] = asyncio.create_task(coroutine)
        return True

    async def wait(self) -> None:
        while running := [task for task in self._running.values() if not task.done()]:
            await asyncio.gather(*running, return_exceptions=True)

    async def subscriptions_stale(self) -> bool:
        synced = await read_setting(SUBSCRIPTIONS_SYNCED_KEY)
        return not synced or _now() - datetime.fromisoformat(synced) >= SUBSCRIPTIONS_TTL

    async def channel_stale(self, channel_id: str) -> bool:
        async with SessionLocal() as session:
            channel = await session.get(Channel, channel_id)
        return (
            channel is None
            or channel.videos_fetched_at is None
            or _now() - channel.videos_fetched_at >= CHANNEL_TTL
        )

    async def schedule_subscriptions(self, force: bool = False) -> bool:
        if not connectivity.online:
            return False
        if force or await self.subscriptions_stale():
            return self._spawn("subscriptions", self.sync_subscriptions(force=force))
        return self.is_running("subscriptions")

    async def schedule_channel(self, channel_id: str, force: bool = False) -> bool:
        if not connectivity.online:
            return False
        if force or await self.channel_stale(channel_id):
            return self._spawn(channel_id, self.refresh_channel(channel_id, force=force))
        return self.is_running(channel_id)

    async def sync_subscriptions(self, force: bool = False) -> bool:
        if not connectivity.online:
            return False
        async with self._lock("subscriptions"):
            if not force and not await self.subscriptions_stale():
                return False
            try:
                remote = await asyncio.to_thread(self.client.subscriptions)
            except YouTubeError as exc:
                logger.warning("could not sync subscriptions: %s", exc)
                return False

            async with SessionLocal() as session:
                await session.execute(
                    update(Channel).values(subscribed=False, subscription_rank=None)
                )
                for rank, item in enumerate(remote):
                    channel = await session.get(Channel, item.id)
                    if channel is None:
                        channel = Channel(id=item.id, name=item.name)
                        session.add(channel)
                    channel.name = item.name
                    channel.handle = item.handle or channel.handle
                    channel.description = item.description or channel.description
                    channel.subscriber_count = item.subscriber_count or channel.subscriber_count
                    channel.subscribed = True
                    channel.subscription_rank = rank
                await session.commit()
            await write_setting(SUBSCRIPTIONS_SYNCED_KEY, _now().isoformat())

            semaphore = asyncio.Semaphore(AVATAR_CONCURRENCY)

            async def cache(item: RemoteChannel) -> None:
                async with semaphore, SessionLocal() as session:
                    channel = await session.get_one(Channel, item.id)
                    await self._cache_avatar(channel, item.avatar_url)
                    await session.commit()

            await asyncio.gather(*(cache(item) for item in remote))
            return True

    async def refresh_channel(self, channel_id: str, force: bool = False) -> bool:
        if not connectivity.online:
            return False
        async with self._lock(channel_id):
            if not force and not await self.channel_stale(channel_id):
                return False
            try:
                page = await asyncio.to_thread(self.client.channel, channel_id)
            except YouTubeError as exc:
                logger.warning("could not refresh channel %s: %s", channel_id, exc)
                return False
            await self._store_page(channel_id, page)
            return True

    async def load_videos(self, channel_id: str, offset: int) -> bool:
        """Cache the page of channel videos starting at offset and say if more follow."""
        async with self._lock(channel_id), SessionLocal() as session:
            stored = {
                video.youtube_id: video.position
                for video in await session.scalars(
                    select(ChannelVideo).where(ChannelVideo.channel_id == channel_id)
                )
            }
            if sum(position >= offset for position in stored.values()) >= PAGE_SIZE:
                return True
            page = await asyncio.to_thread(self.client.channel, channel_id, PAGE_SIZE, offset)
            new = [
                (offset + index, video)
                for index, video in enumerate(page.videos)
                if video.youtube_id not in stored
            ]
            thumbnails = await asyncio.gather(
                *(
                    cache_image(video.thumbnail_url, "thumbnails", video.youtube_id, self.fetch)
                    for _, video in new
                )
            )
            for (position, video), thumbnail in zip(new, thumbnails, strict=True):
                session.add(
                    ChannelVideo(
                        youtube_id=video.youtube_id,
                        channel_id=channel_id,
                        title=video.title,
                        duration_seconds=video.duration_seconds,
                        view_count=video.view_count,
                        published_at=video.published_at,
                        thumbnail_path=thumbnail,
                        position=position,
                    )
                )
            await session.commit()
            return len(page.videos) == PAGE_SIZE

    async def needs_media(self, channel_id: str) -> bool:
        async with SessionLocal() as session:
            channel = await session.get(Channel, channel_id)
        if channel is None or channel.videos_fetched_at is None:
            return True
        cached = all(
            path is None or media_path(path).is_file()
            for path in (channel.avatar_path, channel.banner_path)
        )
        if channel.avatar_path and cached:
            return False
        return _now() - channel.videos_fetched_at >= MEDIA_RETRY or not cached

    async def ensure_channel_media(self, channel_id: str | None) -> None:
        if not channel_id or not connectivity.online:
            return
        try:
            if await self.needs_media(channel_id):
                await self.refresh_channel(channel_id, force=True)
        except Exception:
            logger.exception("could not cache the media of channel %s", channel_id)

    async def ensure_downloaded_channels_media(self) -> None:
        async with SessionLocal() as session:
            channel_ids = list(
                await session.scalars(
                    select(Video.channel_id).where(Video.channel_id.is_not(None)).distinct()
                )
            )
        for channel_id in channel_ids:
            await self.ensure_channel_media(channel_id)

    async def keep_channel_media(self, interval: float = MEDIA_SWEEP_INTERVAL) -> None:
        while True:
            await self.ensure_downloaded_channels_media()
            await asyncio.sleep(interval)

    async def _store_page(self, channel_id: str, page: ChannelPage) -> None:
        remote = page.channel
        async with SessionLocal() as session:
            channel = await session.get(Channel, channel_id)
            if channel is None:
                channel = Channel(id=channel_id, name=remote.name)
                session.add(channel)
            channel.name = remote.name
            channel.handle = remote.handle or channel.handle
            channel.description = remote.description
            channel.subscriber_count = remote.subscriber_count or channel.subscriber_count
            channel.videos_fetched_at = _now()
            await self._cache_avatar(channel, remote.avatar_url)
            channel.banner_path = await cache_image(
                remote.banner_url, "banners", channel_id, self.fetch, channel.banner_path
            )
            channel.banner_source_url = remote.banner_url or channel.banner_source_url

            previous = {
                video.youtube_id: video
                for video in await session.scalars(
                    select(ChannelVideo).where(ChannelVideo.channel_id == channel_id)
                )
            }
            await session.execute(delete(ChannelVideo).where(ChannelVideo.channel_id == channel_id))
            await session.flush()
            keep = set()
            for position, video in enumerate(page.videos):
                old = previous.get(video.youtube_id)
                thumbnail = await cache_image(
                    video.thumbnail_url,
                    "thumbnails",
                    video.youtube_id,
                    self.fetch,
                    old.thumbnail_path if old else None,
                )
                keep.add(thumbnail)
                session.add(
                    ChannelVideo(
                        youtube_id=video.youtube_id,
                        channel_id=channel_id,
                        title=video.title,
                        duration_seconds=video.duration_seconds,
                        view_count=video.view_count,
                        published_at=video.published_at,
                        thumbnail_path=thumbnail,
                        position=position,
                    )
                )
            await session.commit()
        for old in previous.values():
            if old.thumbnail_path not in keep:
                remove_cached(old.thumbnail_path)

    async def _cache_avatar(self, channel: Channel, url: str | None) -> None:
        channel.avatar_path = await cache_image(
            url, "avatars", channel.id, self.fetch, channel.avatar_path
        )
        channel.avatar_source_url = url or channel.avatar_source_url

    async def backfill_video_channels(self, resolve) -> None:
        if not connectivity.online:
            return
        async with SessionLocal() as session:
            videos = list(await session.scalars(select(Video).where(Video.channel_id.is_(None))))
        for video in videos:
            try:
                channel_id = await asyncio.to_thread(resolve, video.youtube_url)
            except Exception as exc:
                logger.info("could not resolve the channel of %s: %s", video.youtube_id, exc)
                continue
            if not channel_id:
                continue
            async with SessionLocal() as session, session.begin():
                await session.execute(
                    update(Video).where(Video.id == video.id).values(channel_id=channel_id)
                )
            await self.ensure_channel_media(channel_id)
