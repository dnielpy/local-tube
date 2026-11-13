import asyncio
import contextlib
import logging
import threading
import uuid
from collections.abc import Awaitable, Callable
from typing import Protocol

from sqlalchemy import func, or_, select, update

from app.db import SessionLocal
from app.media import remove_video_dir
from app.models import DownloadJob, JobStatus, Video
from app.services.connectivity import connectivity
from app.services.downloader import (
    DownloadCancelled,
    DownloadError,
    DownloadResult,
    Probe,
    Progress,
)
from app.services.image_cache import ImageFetcher, cache_image
from app.services.library import link_video
from app.services.profiles import cookies_path
from app.services.youtube import video_thumbnail_url
from app.services.youtube_cookies import mark_expired, needs_sign_in

logger = logging.getLogger(__name__)

ACTIVE_STATUSES = (JobStatus.queued, JobStatus.downloading, JobStatus.processing)
FLUSH_INTERVAL = 1.0
IDLE_POLL_INTERVAL = 5.0
MEDIA_TIMEOUT = 60.0


class Downloader(Protocol):
    def probe(self, url: str, cookies_file: str | None = None) -> Probe: ...

    def download(
        self,
        probe: Probe,
        on_progress: "ProgressCallback",
        max_height: int | None = None,
        should_cancel: Callable[[], bool] = ...,
        cookies_file: str | None = None,
    ) -> DownloadResult: ...


class ProgressCallback(Protocol):
    def __call__(self, progress: Progress) -> None: ...


class DownloadWorker:
    def __init__(
        self,
        downloader: Downloader,
        concurrency: int = 1,
        on_video_added: Callable[[str | None], Awaitable[None]] | None = None,
        fetch_image: ImageFetcher | None = None,
    ) -> None:
        self.fetch_image = fetch_image
        self._cancel: dict[uuid.UUID, threading.Event] = {}
        self.downloader = downloader
        self.concurrency = concurrency
        self.on_video_added = on_video_added
        self._wakeup = asyncio.Event()
        self._tasks: list[asyncio.Task[None]] = []

    async def start(self) -> None:
        await requeue_interrupted_jobs()
        self._tasks = [asyncio.create_task(self._loop()) for _ in range(self.concurrency)]

    async def stop(self) -> None:
        for task in self._tasks:
            task.cancel()
        for task in self._tasks:
            with contextlib.suppress(asyncio.CancelledError):
                await task
        self._tasks = []

    def notify(self) -> None:
        self._wakeup.set()

    def cancel(self, job_id: uuid.UUID) -> bool:
        event = self._cancel.get(job_id)
        if event is None:
            return False
        event.set()
        return True

    async def _loop(self) -> None:
        while True:
            try:
                processed = await self.run_once()
            except Exception:
                logger.exception("download worker iteration failed")
                processed = False
            if not processed:
                self._wakeup.clear()
                with contextlib.suppress(TimeoutError):
                    await asyncio.wait_for(self._wakeup.wait(), IDLE_POLL_INTERVAL)

    async def run_once(self) -> bool:
        if not connectivity.online:
            return False
        claimed = await claim_next_job()
        if claimed is None:
            return False
        job_id, url, max_height, profile_id = claimed
        cancelled = self._cancel[job_id] = threading.Event()
        try:
            await self._process(job_id, url, max_height, profile_id, cancelled)
        except DownloadCancelled:
            await _update_job(job_id, status=JobStatus.cancelled, error=None, speed=None, eta=None)
        except DownloadError as exc:
            await _update_job(job_id, status=JobStatus.failed, error=str(exc), speed=None, eta=None)
            if profile_id is not None and needs_sign_in(str(exc)):
                await mark_expired(profile_id)
        except Exception as exc:
            logger.exception("download %s failed", job_id)
            await _update_job(job_id, status=JobStatus.failed, error=str(exc), speed=None, eta=None)
        finally:
            self._cancel.pop(job_id, None)
        return True

    async def _process(
        self,
        job_id: uuid.UUID,
        url: str,
        max_height: int | None,
        profile_id: uuid.UUID | None,
        cancelled: threading.Event,
    ) -> None:
        cookies_file = cookies_path(profile_id)
        probe = await asyncio.to_thread(self.downloader.probe, url, cookies_file)
        if cancelled.is_set():
            raise DownloadCancelled("Cancelled")
        duration = probe.info.get("duration")
        await _update_job(
            job_id,
            title=probe.title,
            duration_seconds=int(duration) if duration else None,
        )
        if self.fetch_image is not None:
            thumbnail = await cache_image(
                video_thumbnail_url(probe.youtube_id),
                "thumbnails",
                probe.youtube_id,
                self.fetch_image,
            )
            await _update_job(job_id, thumbnail_path=thumbnail)

        existing = await _find_video(probe.youtube_id)
        if existing is not None:
            if profile_id is not None:
                async with SessionLocal() as session, session.begin():
                    await link_video(session, profile_id, existing.id)
            await _update_job(
                job_id, status=JobStatus.completed, progress=100, video_id=existing.id
            )
            return

        latest: list[Progress] = []
        download = asyncio.create_task(
            asyncio.to_thread(
                self.downloader.download,
                probe,
                latest.append,
                max_height,
                cancelled.is_set,
                cookies_file,
            )
        )
        while not download.done():
            await asyncio.wait({download}, timeout=FLUSH_INTERVAL)
            if not cancelled.is_set():
                await _flush_progress(job_id, latest)
        try:
            if cancelled.is_set():
                raise DownloadCancelled("Cancelled")
            await _flush_progress(job_id, latest)
            result = download.result()
        except DownloadCancelled:
            if await _find_video(probe.youtube_id) is None:
                remove_video_dir(probe.youtube_id)
            raise

        if self.on_video_added is not None:
            try:
                await asyncio.wait_for(self.on_video_added(result.channel_id), MEDIA_TIMEOUT)
            except Exception:
                logger.warning("could not cache the channel of %s", result.youtube_id)

        async with SessionLocal() as session:
            video = await _find_video(result.youtube_id, session)
            if video is None:
                video = Video(**vars(result))
                session.add(video)
                await session.flush()
            if profile_id is not None:
                await link_video(session, profile_id, video.id)
            job = await session.get_one(DownloadJob, job_id)
            job.status = JobStatus.completed
            job.progress = 100
            job.speed = job.eta = None
            job.title = result.title
            job.video_id = video.id
            await session.commit()


async def claim_next_job() -> tuple[uuid.UUID, str, int | None, uuid.UUID | None] | None:
    async with SessionLocal() as session, session.begin():
        job = await session.scalar(
            select(DownloadJob)
            .where(
                DownloadJob.status == JobStatus.queued,
                or_(DownloadJob.start_at.is_(None), DownloadJob.start_at <= func.now()),
            )
            .order_by(DownloadJob.created_at)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        if job is None:
            return None
        job.status = JobStatus.downloading
        job.progress = 0
        job.error = None
        return job.id, job.url, job.max_height, job.profile_id


async def requeue_interrupted_jobs() -> None:
    async with SessionLocal() as session, session.begin():
        await session.execute(
            update(DownloadJob)
            .where(DownloadJob.status.in_((JobStatus.downloading, JobStatus.processing)))
            .values(status=JobStatus.queued, progress=0, speed=None, eta=None)
        )


async def _find_video(youtube_id: str, session=None) -> Video | None:
    if session is not None:
        return await session.scalar(select(Video).where(Video.youtube_id == youtube_id))
    async with SessionLocal() as own:
        return await own.scalar(select(Video).where(Video.youtube_id == youtube_id))


async def _flush_progress(job_id: uuid.UUID, pending: list[Progress]) -> None:
    if not pending:
        return
    progress = pending[-1]
    if not progress.total_bytes:
        progress.total_bytes = next((p.total_bytes for p in pending if p.total_bytes), None)
    pending.clear()
    await _write_progress(job_id, progress)


async def _write_progress(job_id: uuid.UUID, progress: Progress) -> None:
    if progress.status == "processing":
        await _update_job(job_id, status=JobStatus.processing, progress=100, speed=None, eta=None)
        return
    values: dict[str, object] = {
        "speed": format_speed(progress.speed),
        "eta": format_eta(progress.eta),
    }
    if progress.percent is not None:
        values["progress"] = round(progress.percent, 1)
    if progress.total_bytes:
        values["size_bytes"] = progress.total_bytes
    await _update_job(job_id, **values)


async def _update_job(job_id: uuid.UUID, **values: object) -> None:
    async with SessionLocal() as session, session.begin():
        await session.execute(update(DownloadJob).where(DownloadJob.id == job_id).values(**values))


def format_speed(speed: float | None) -> str | None:
    if not speed:
        return None
    for unit in ("B", "KiB", "MiB", "GiB"):
        if speed < 1024 or unit == "GiB":
            return f"{speed:.1f} {unit}/s"
        speed /= 1024
    return None


def format_eta(eta: int | None) -> str | None:
    if eta is None:
        return None
    minutes, seconds = divmod(int(eta), 60)
    hours, minutes = divmod(minutes, 60)
    return f"{hours}:{minutes:02d}:{seconds:02d}" if hours else f"{minutes}:{seconds:02d}"
