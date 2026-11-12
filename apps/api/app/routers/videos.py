import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import func, or_, select

from app.db import SessionDep
from app.media import media_path
from app.models import Profile, ProfileVideo, Video
from app.schemas import VideoOut, VideoPage
from app.services.library import in_library, unlink_video
from app.services.profiles import ProfileDep

router = APIRouter(prefix="/videos", tags=["videos"])


async def _get_video(session: SessionDep, profile: Profile, video_id: uuid.UUID) -> Video:
    video = await session.scalar(select(Video).where(Video.id == video_id, in_library(profile.id)))
    if video is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video not found")
    return video


@router.get("", response_model=VideoPage)
async def list_videos(
    session: SessionDep,
    profile: ProfileDep,
    q: str | None = None,
    channel: str | None = None,
    channel_id: str | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 60,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> VideoPage:
    query = (
        select(Video)
        .join(ProfileVideo, ProfileVideo.video_id == Video.id)
        .where(ProfileVideo.profile_id == profile.id)
    )
    if q:
        pattern = f"%{q}%"
        query = query.where(or_(Video.title.ilike(pattern), Video.channel.ilike(pattern)))
    if channel:
        query = query.where(Video.channel == channel)
    if channel_id:
        query = query.where(Video.channel_id == channel_id)
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    rows = await session.scalars(
        query.order_by(ProfileVideo.created_at.desc()).limit(limit).offset(offset)
    )
    return VideoPage(items=[VideoOut.model_validate(v) for v in rows], total=total or 0)


@router.get("/channels", response_model=list[str])
async def list_channels(session: SessionDep, profile: ProfileDep) -> list[str]:
    rows = await session.scalars(
        select(Video.channel)
        .join(ProfileVideo, ProfileVideo.video_id == Video.id)
        .where(ProfileVideo.profile_id == profile.id, Video.channel.is_not(None))
        .group_by(Video.channel)
        .order_by(func.max(ProfileVideo.created_at).desc())
    )
    return list(rows)


@router.get("/{video_id}", response_model=VideoOut)
async def get_video(session: SessionDep, profile: ProfileDep, video_id: uuid.UUID) -> Video:
    return await _get_video(session, profile, video_id)


@router.get("/{video_id}/stream")
async def stream_video(
    session: SessionDep, profile: ProfileDep, video_id: uuid.UUID
) -> FileResponse:
    video = await _get_video(session, profile, video_id)
    path = media_path(video.file_path)
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video file missing")
    return FileResponse(path, media_type="video/mp4")


@router.get("/{video_id}/thumbnail")
async def video_thumbnail(
    session: SessionDep, profile: ProfileDep, video_id: uuid.UUID
) -> FileResponse:
    video = await _get_video(session, profile, video_id)
    if not video.thumbnail_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Thumbnail not found")
    path = media_path(video.thumbnail_path)
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Thumbnail file missing")
    return FileResponse(path, headers={"Cache-Control": "public, max-age=86400"})


@router.delete("/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(session: SessionDep, profile: ProfileDep, video_id: uuid.UUID) -> None:
    video = await _get_video(session, profile, video_id)
    await unlink_video(session, profile.id, video)
