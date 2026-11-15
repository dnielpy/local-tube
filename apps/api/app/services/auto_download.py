import asyncio
import logging
import uuid
from datetime import date, datetime

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionLocal
from app.models import AutoDownloadChannel, DownloadJob, Video
from app.schemas import AutoDownloadSettings
from app.services.channels import ChannelService
from app.services.connectivity import connectivity
from app.services.downloads import AlreadyInLibrary, AlreadyQueued, queue_download
from app.services.library import in_library
from app.services.worker import ACTIVE_STATUSES, DownloadWorker
from app.services.youtube import NOT_DOWNLOADABLE, RemoteVideo, YouTubeError
from app.settings_store import read_setting, write_setting

logger = logging.getLogger(__name__)

AUTO_DOWNLOAD_SWEEP_INTERVAL = 60


def _settings_key(profile_id: uuid.UUID) -> str:
    return f"auto_download:{profile_id}"


def _ran_key(profile_id: uuid.UUID) -> str:
    return f"auto_download_ran_on:{profile_id}"


async def read_settings(profile_id: uuid.UUID) -> AutoDownloadSettings:
    stored = await read_setting(_settings_key(profile_id))
    return AutoDownloadSettings.model_validate_json(stored) if stored else AutoDownloadSettings()


async def write_settings(profile_id: uuid.UUID, settings: AutoDownloadSettings) -> None:
    await write_setting(_settings_key(profile_id), settings.model_dump_json())


async def ran_on(profile_id: uuid.UUID) -> date | None:
    stored = await read_setting(_ran_key(profile_id))
    return date.fromisoformat(stored) if stored else None


async def pending_videos(
    session: AsyncSession, profile_id: uuid.UUID, channel_id: str, latest: list[RemoteVideo]
) -> list[RemoteVideo]:
    """The videos of `latest` newer than the newest one of the channel in the library.

    With no video of the channel in the library yet, only its latest one. Live streams,
    premieres and videos already being downloaded are left out.
    """
    owned = set(
        await session.scalars(
            select(Video.youtube_id).where(
                Video.youtube_id.in_([video.youtube_id for video in latest]),
                in_library(profile_id),
            )
        )
    )
    newer = []
    for video in latest:
        if video.youtube_id in owned:
            break
        newer.append(video)
    newer = [video for video in newer if video.live_status not in NOT_DOWNLOADABLE]
    if not owned:
        has_any = await session.scalar(
            select(exists().where(Video.channel_id == channel_id, in_library(profile_id)))
        )
        if not has_any:
            newer = newer[:1]

    queued = set(
        await session.scalars(
            select(DownloadJob.youtube_id).where(
                DownloadJob.profile_id == profile_id,
                DownloadJob.youtube_id.in_([video.youtube_id for video in newer]),
                DownloadJob.status.in_(ACTIVE_STATUSES),
            )
        )
    )
    return [video for video in newer if video.youtube_id not in queued]


async def run_for_profile(
    profile_id: uuid.UUID, service: ChannelService, worker: DownloadWorker | None
) -> int:
    """Queue the new videos of the profile's auto-download channels and say how many."""
    settings = await read_settings(profile_id)
    async with SessionLocal() as session:
        channel_ids = list(
            await session.scalars(
                select(AutoDownloadChannel.channel_id).where(
                    AutoDownloadChannel.profile_id == profile_id
                )
            )
        )
        queued = 0
        for channel_id in channel_ids:
            try:
                latest = await service.latest_videos(channel_id, settings.per_channel)
            except YouTubeError as exc:
                logger.warning("could not check the channel %s: %s", channel_id, exc)
                continue
            for video in await pending_videos(session, profile_id, channel_id, latest):
                try:
                    await queue_download(
                        session,
                        worker,
                        profile_id,
                        f"https://www.youtube.com/watch?v={video.youtube_id}",
                        settings.max_height,
                        title=video.title,
                    )
                except (AlreadyInLibrary, AlreadyQueued):
                    continue
                queued += 1
    return queued


async def auto_download_profile_ids() -> list[uuid.UUID]:
    async with SessionLocal() as session:
        return list(await session.scalars(select(AutoDownloadChannel.profile_id).distinct()))


async def run_due(service: ChannelService, worker: DownloadWorker | None, now: datetime) -> None:
    """Run the auto-download of every profile whose hour came today and has not run yet.

    Offline it waits, so it runs as soon as the connection comes back.
    """
    if not connectivity.online:
        return
    today = now.date()
    for profile_id in await auto_download_profile_ids():
        settings = await read_settings(profile_id)
        if now.strftime("%H:%M") < settings.start_time or await ran_on(profile_id) == today:
            continue
        try:
            queued = await run_for_profile(profile_id, service, worker)
        except Exception:
            logger.exception("could not auto-download the videos of %s", profile_id)
            continue
        await write_setting(_ran_key(profile_id), today.isoformat())
        logger.info("auto-download queued %d videos for %s", queued, profile_id)


async def keep_auto_downloading(
    service: ChannelService,
    worker: DownloadWorker | None,
    interval: float = AUTO_DOWNLOAD_SWEEP_INTERVAL,
) -> None:
    while True:
        try:
            await run_due(service, worker, datetime.now().astimezone())
        except Exception:
            logger.exception("auto-download sweep failed")
        await asyncio.sleep(interval)
