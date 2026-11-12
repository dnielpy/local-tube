import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select

from app.db import SessionDep
from app.models import DownloadJob, JobStatus, Video
from app.schemas import DownloadCreate, DownloadJobOut
from app.services.downloader import parse_youtube_id
from app.services.worker import ACTIVE_STATUSES, DownloadWorker

router = APIRouter(prefix="/downloads", tags=["downloads"])


def get_worker(request: Request) -> DownloadWorker | None:
    return getattr(request.app.state, "worker", None)


WorkerDep = Annotated[DownloadWorker | None, Depends(get_worker)]


async def _get_job(session: SessionDep, job_id: uuid.UUID) -> DownloadJob:
    job = await session.get(DownloadJob, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Download not found")
    return job


@router.post("", response_model=DownloadJobOut, status_code=status.HTTP_201_CREATED)
async def create_download(
    body: DownloadCreate, session: SessionDep, worker: WorkerDep
) -> DownloadJob:
    url = body.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Paste a full video URL")

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

    job = DownloadJob(url=url)
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
