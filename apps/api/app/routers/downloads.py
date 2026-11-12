import asyncio
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select

from app.config import get_settings
from app.db import SessionDep
from app.models import DownloadJob, JobStatus, Video
from app.schemas import DownloadCreate, DownloadJobOut, QualityOut, VideoFormatsOut
from app.services.connectivity import connectivity
from app.services.downloader import DownloadError, Quality, YtDlpDownloader, parse_youtube_id
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


async def _get_job(session: SessionDep, job_id: uuid.UUID) -> DownloadJob:
    job = await session.get(DownloadJob, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Download not found")
    return job


@router.get("/formats", response_model=VideoFormatsOut)
async def video_formats(
    session: SessionDep, downloader: DownloaderDep, url: Annotated[str, Query()]
) -> VideoFormatsOut:
    url = _validate_url(url)
    if not connectivity.online:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, {"message": "Sin conexión"})
    try:
        info = await asyncio.to_thread(downloader.formats, url)
    except DownloadError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    video_id = await session.scalar(select(Video.id).where(Video.youtube_id == info.youtube_id))
    return VideoFormatsOut(
        youtube_id=info.youtube_id,
        title=info.title,
        channel=info.channel,
        duration_seconds=info.duration_seconds,
        qualities=[QualityOut(height=q.height, size_bytes=q.size_bytes) for q in info.qualities],
        default_height=default_height(info.qualities, get_settings().default_max_height),
        video_id=video_id,
    )


@router.post("", response_model=DownloadJobOut, status_code=status.HTTP_201_CREATED)
async def create_download(
    body: DownloadCreate, session: SessionDep, worker: WorkerDep
) -> DownloadJob:
    url = _validate_url(body.url)

    youtube_id = parse_youtube_id(url)
    if youtube_id is not None:
        video = await session.scalar(select(Video).where(Video.youtube_id == youtube_id))
        if video is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                {"message": "This video is already in the library", "video_id": str(video.id)},
            )

    active = await session.scalar(
        select(DownloadJob).where(DownloadJob.url == url, DownloadJob.status.in_(ACTIVE_STATUSES))
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
    job = DownloadJob(url=url, youtube_id=youtube_id, max_height=max_height)
    session.add(job)
    await session.commit()
    await session.refresh(job)
    if worker is not None:
        worker.notify()
    return job


@router.get("", response_model=list[DownloadJobOut])
async def list_downloads(session: SessionDep) -> list[DownloadJob]:
    rows = await session.scalars(select(DownloadJob).order_by(DownloadJob.created_at.desc()))
    return list(rows)


@router.get("/{job_id}", response_model=DownloadJobOut)
async def get_download(session: SessionDep, job_id: uuid.UUID) -> DownloadJob:
    return await _get_job(session, job_id)


@router.post("/{job_id}/retry", response_model=DownloadJobOut)
async def retry_download(session: SessionDep, worker: WorkerDep, job_id: uuid.UUID) -> DownloadJob:
    job = await _get_job(session, job_id)
    if job.status != JobStatus.failed:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only failed downloads can be retried")
    job.status = JobStatus.queued
    job.progress = 0
    job.error = None
    await session.commit()
    await session.refresh(job)
    if worker is not None:
        worker.notify()
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_download(session: SessionDep, job_id: uuid.UUID) -> None:
    job = await _get_job(session, job_id)
    if job.status in (JobStatus.downloading, JobStatus.processing):
        raise HTTPException(status.HTTP_409_CONFLICT, "Cannot remove a download in progress")
    await session.delete(job)
    await session.commit()
