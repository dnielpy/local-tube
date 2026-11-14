import uuid

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import exists, select
from sqlalchemy.dialects.postgresql import insert

from app.db import SessionDep
from app.media import media_path
from app.models import ProfileVideo, Video, VideoShare
from app.schemas import ShareOut, SharePreviewOut, VideoOut
from app.services.library import in_library, link_video
from app.services.profiles import ProfileDep

router = APIRouter(tags=["shares"])


async def _get_share(session: SessionDep, share_id: uuid.UUID) -> VideoShare:
    share = await session.get(VideoShare, share_id)
    if share is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Share not found")
    return share


@router.post(
    "/videos/{video_id}/share", response_model=ShareOut, status_code=status.HTTP_201_CREATED
)
async def share_video(session: SessionDep, profile: ProfileDep, video_id: uuid.UUID) -> VideoShare:
    owned = await session.scalar(
        select(exists().where(Video.id == video_id, in_library(profile.id)))
    )
    if not owned:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video not found")
    # Sharing the same video again gives back the link made the first time.
    await session.execute(
        insert(VideoShare)
        .values(id=uuid.uuid4(), video_id=video_id, profile_id=profile.id)
        .on_conflict_do_nothing()
    )
    await session.commit()
    share = await session.scalar(
        select(VideoShare).where(
            VideoShare.video_id == video_id, VideoShare.profile_id == profile.id
        )
    )
    assert share is not None
    return share


@router.get("/shares/{share_id}", response_model=SharePreviewOut)
async def get_share(
    session: SessionDep, profile: ProfileDep, share_id: uuid.UUID
) -> SharePreviewOut:
    share = await _get_share(session, share_id)
    saved = await session.scalar(
        select(
            exists().where(
                ProfileVideo.profile_id == profile.id, ProfileVideo.video_id == share.video_id
            )
        )
    )
    return SharePreviewOut.model_validate(
        {
            "id": share.id,
            "shared_by": share.profile,
            "video": share.video,
            "thumbnail_url": f"/api/shares/{share.id}/thumbnail"
            if share.video.thumbnail_path
            else None,
            "in_library": bool(saved),
        },
        from_attributes=True,
    )


@router.get("/shares/{share_id}/thumbnail")
async def share_thumbnail(
    session: SessionDep, profile: ProfileDep, share_id: uuid.UUID
) -> FileResponse:
    share = await _get_share(session, share_id)
    if not share.video.thumbnail_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Thumbnail not found")
    path = media_path(share.video.thumbnail_path)
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Thumbnail file missing")
    return FileResponse(path, headers={"Cache-Control": "public, max-age=86400"})


@router.post("/shares/{share_id}/save", response_model=VideoOut)
async def save_share(session: SessionDep, profile: ProfileDep, share_id: uuid.UUID) -> Video:
    share = await _get_share(session, share_id)
    await link_video(session, profile.id, share.video_id)
    await session.commit()
    return share.video
