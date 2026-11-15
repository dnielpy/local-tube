import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DownloadJob, JobStatus, Video
from app.services.downloader import parse_youtube_id
from app.services.library import library_video, link_video
from app.services.worker import ACTIVE_STATUSES, DownloadWorker


class AlreadyInLibrary(Exception):
    def __init__(self, video: Video) -> None:
        self.video = video


class AlreadyQueued(Exception):
    def __init__(self, job: DownloadJob) -> None:
        self.job = job


async def _link_downloaded(
    session: AsyncSession, profile_id: uuid.UUID, url: str, video: Video
) -> DownloadJob:
    """Another profile already downloaded this video: add the same file to this library."""
    await link_video(session, profile_id, video.id)
    job = DownloadJob(
        url=url,
        youtube_id=video.youtube_id,
        profile_id=profile_id,
        status=JobStatus.completed,
        progress=100,
        title=video.title,
        duration_seconds=video.duration_seconds,
        size_bytes=video.file_size,
        thumbnail_path=video.thumbnail_path,
        video_id=video.id,
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)
    return job


async def queue_download(
    session: AsyncSession,
    worker: DownloadWorker | None,
    profile_id: uuid.UUID,
    url: str,
    max_height: int | None,
    title: str | None = None,
    start_at: datetime | None = None,
) -> DownloadJob:
    """Queue a download for the profile, or reuse the file another profile already has.

    Raises AlreadyInLibrary or AlreadyQueued when the profile has it or is getting it.
    """
    youtube_id = parse_youtube_id(url)
    if youtube_id is not None:
        video = await library_video(session, profile_id, youtube_id)
        if video is not None:
            raise AlreadyInLibrary(video)
        video = await session.scalar(select(Video).where(Video.youtube_id == youtube_id))
        if video is not None:
            return await _link_downloaded(session, profile_id, url, video)

    active = await session.scalar(
        select(DownloadJob).where(
            DownloadJob.profile_id == profile_id,
            DownloadJob.url == url,
            DownloadJob.status.in_(ACTIVE_STATUSES),
        )
    )
    if active is not None:
        raise AlreadyQueued(active)

    job = DownloadJob(
        url=url,
        youtube_id=youtube_id,
        max_height=max_height,
        start_at=start_at,
        title=title,
        profile_id=profile_id,
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)
    if worker is not None:
        worker.notify()
    return job
