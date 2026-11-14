import asyncio
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.config import get_settings
from app.db import SessionDep
from app.media import media_path, remove_video_dir
from app.models import DownloadJob, JobStatus, Profile, Video
from app.schemas import DownloadCreate, DownloadJobOut, QualityOut, VideoFormatsOut
from app.services.connectivity import connectivity
from app.services.downloader import DownloadError, Quality, YtDlpDownloader, parse_youtube_id
from app.services.library import library_video, link_video
from app.services.profiles import ProfileDep, cookies_path
from app.services.worker import ACTIVE_STATUSES, DownloadWorker

router = APIRouter(prefix="/downloads", tags=["downloads"])


def get_worker(request: Request) -> DownloadWorker | None:
    return getattr(request.app.state, "worker", None)


WorkerDep = Annotated[DownloadWorker | None, Depends(get_worker)]


def get_downloader(request: Request) -> YtDlpDownloader:
    return request.app.state.downloader


DownloaderDep = Annotated[YtDlpDownloader, Depends(get_downloader)]


def default_height(qualities: list[Quality], preferred: int) -> int | None:
    if not qualities:
        return None
    heights = [quality.height for quality in qualities]
    lower = [height for height in heights if height <= preferred]
    return max(lower) if lower else min(heights)


def _validate_url(url: str) -> str:
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Paste a full video URL")
    return url


async def _get_job(
    session: SessionDep, profile: Profile, job_id: uuid.UUID, for_update: bool = False
) -> DownloadJob:
    job = await session.get(DownloadJob, job_id, with_for_update=for_update)
    if job is None or job.profile_id != profile.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Download not found")
    return job


@router.get("/formats", response_model=VideoFormatsOut)
async def video_formats(
    session: SessionDep,
    downloader: DownloaderDep,
    profile: ProfileDep,
    url: Annotated[str, Query()],
) -> VideoFormatsOut:
    url = _validate_url(url)
    if not connectivity.online:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, {"message": "Sin conexión"})
    try:
        info = await asyncio.to_thread(downloader.formats, url, cookies_path(profile.id))
    except DownloadError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    video = await library_video(session, profile.id, info.youtube_id)
    return VideoFormatsOut(
        youtube_id=info.youtube_id,
        title=info.title,
        channel=info.channel,
        duration_seconds=info.duration_seconds,
        qualities=[QualityOut(height=q.height, size_bytes=q.size_bytes) for q in info.qualities],
        default_height=default_height(info.qualities, get_settings().default_max_height),
        video_id=video.id if video else None,
    )


async def _link_downloaded(
    session: SessionDep, profile: Profile, url: str, video: Video
) -> DownloadJob:
    """Another profile already downloaded this video: add the same file to this library."""
    await link_video(session, profile.id, video.id)
    job = DownloadJob(
        url=url,
        youtube_id=video.youtube_id,
        profile_id=profile.id,
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


@router.post("", response_model=DownloadJobOut, status_code=status.HTTP_201_CREATED)
async def create_download(
    body: DownloadCreate, session: SessionDep, worker: WorkerDep, profile: ProfileDep
) -> DownloadJob:
    url = _validate_url(body.url)

    youtube_id = parse_youtube_id(url)
    if youtube_id is not None:
        video = await library_video(session, profile.id, youtube_id)
        if video is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                {"message": "This video is already in the library", "video_id": str(video.id)},
            )
        video = await session.scalar(select(Video).where(Video.youtube_id == youtube_id))
        if video is not None:
            return await _link_downloaded(session, profile, url, video)

    active = await session.scalar(
        select(DownloadJob).where(
            DownloadJob.profile_id == profile.id,
            DownloadJob.url == url,
            DownloadJob.status.in_(ACTIVE_STATUSES),
        )
    )
    if active is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {"message": "This video is already being downloaded", "job_id": str(active.id)},
        )

    max_height = (
        body.max_height
        if "max_height" in body.model_fields_set
        else get_settings().default_max_height
    )
    job = DownloadJob(
        url=url,
        youtube_id=youtube_id,
        max_height=max_height,
        start_at=body.start_at,
        title=body.title,
        profile_id=profile.id,
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)
    if worker is not None:
        worker.notify()
    return job


@router.get("", response_model=list[DownloadJobOut])
async def list_downloads(session: SessionDep, profile: ProfileDep) -> list[DownloadJob]:
    rows = await session.scalars(
        select(DownloadJob)
        .where(DownloadJob.profile_id == profile.id)
        .order_by(DownloadJob.created_at.desc())
    )
    return list(rows)


@router.get("/{job_id}", response_model=DownloadJobOut)
async def get_download(session: SessionDep, profile: ProfileDep, job_id: uuid.UUID) -> DownloadJob:
    return await _get_job(session, profile, job_id)


@router.get("/{job_id}/thumbnail")
async def download_thumbnail(
    session: SessionDep, profile: ProfileDep, job_id: uuid.UUID
) -> FileResponse:
    job = await _get_job(session, profile, job_id)
    if not job.thumbnail_path or not media_path(job.thumbnail_path).is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Thumbnail not cached")
    return FileResponse(
        media_path(job.thumbnail_path), headers={"Cache-Control": "public, max-age=604800"}
    )


@router.post("/{job_id}/retry", response_model=DownloadJobOut)
async def retry_download(
    session: SessionDep, worker: WorkerDep, profile: ProfileDep, job_id: uuid.UUID
) -> DownloadJob:
    job = await _get_job(session, profile, job_id)
    if job.status not in (JobStatus.failed, JobStatus.cancelled):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Only failed or cancelled downloads can be retried"
        )
    # The progress stays: the download continues from the partial files.
    job.status = JobStatus.queued
    job.error = None
    job.attempts = 0
    job.retry_at = None
    await session.commit()
    await session.refresh(job)
    if worker is not None:
        worker.notify()
    return job


@router.post("/{job_id}/cancel", response_model=DownloadJobOut)
async def cancel_download(
    session: SessionDep, worker: WorkerDep, profile: ProfileDep, job_id: uuid.UUID
) -> DownloadJob:
    job = await _get_job(session, profile, job_id, for_update=True)
    if job.status not in ACTIVE_STATUSES:
        raise HTTPException(status.HTTP_409_CONFLICT, "This download is not running")
    running = job.status != JobStatus.queued and worker is not None and worker.cancel(job.id)
    if not running:
        job.status = JobStatus.cancelled
        job.speed = job.eta = None
    await session.commit()
    await session.refresh(job)
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_download(session: SessionDep, profile: ProfileDep, job_id: uuid.UUID) -> None:
    job = await _get_job(session, profile, job_id)
    if job.status in (JobStatus.downloading, JobStatus.processing):
        raise HTTPException(status.HTTP_409_CONFLICT, "Cannot remove a download in progress")
    await session.delete(job)
    await session.commit()
    if job.youtube_id and job.status != JobStatus.completed:
        await _remove_partial_files(session, job.youtube_id)


async def _remove_partial_files(session: SessionDep, youtube_id: str) -> None:
    """A paused or failed download keeps its partial files until it is removed."""
    downloaded = await session.scalar(select(Video.id).where(Video.youtube_id == youtube_id))
    others = await session.scalar(
        select(DownloadJob.id).where(
            DownloadJob.youtube_id == youtube_id,
            DownloadJob.status.not_in((JobStatus.completed,)),
        )
    )
    if downloaded is None and others is None:
        remove_video_dir(youtube_id)
