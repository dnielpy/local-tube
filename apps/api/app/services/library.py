import uuid

from sqlalchemy import delete, exists, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.media import remove_video_dir
from app.models import DownloadJob, Playlist, PlaylistItem, ProfileVideo, Video, WatchEntry


def in_library(profile_id: uuid.UUID):
    """Filter for videos that belong to the library of a profile."""
    return exists().where(ProfileVideo.video_id == Video.id, ProfileVideo.profile_id == profile_id)


async def library_video(
    session: AsyncSession, profile_id: uuid.UUID, youtube_id: str
) -> Video | None:
    return await session.scalar(
        select(Video).where(Video.youtube_id == youtube_id, in_library(profile_id))
    )


async def link_video(session: AsyncSession, profile_id: uuid.UUID, video_id: uuid.UUID) -> None:
    await session.execute(
        insert(ProfileVideo)
        .values(profile_id=profile_id, video_id=video_id)
        .on_conflict_do_nothing()
    )


async def unlink_video(session: AsyncSession, profile_id: uuid.UUID, video: Video) -> None:
    """Remove a video from a library, and from the disk once no profile keeps it."""
    link = await session.get(ProfileVideo, (profile_id, video.id))
    if link is not None:
        await session.delete(link)
    # Out of the library also means out of this profile's history and playlists.
    await session.execute(
        delete(WatchEntry).where(
            WatchEntry.profile_id == profile_id, WatchEntry.video_id == video.id
        )
    )
    await session.execute(
        delete(PlaylistItem).where(
            PlaylistItem.video_id == video.id,
            PlaylistItem.playlist_id.in_(
                select(Playlist.id).where(Playlist.profile_id == profile_id)
            ),
        )
    )
    await session.flush()
    kept = await session.scalar(select(exists().where(ProfileVideo.video_id == video.id)))
    if not kept:
        await session.delete(video)
    await session.commit()
    if not kept:
        remove_video_dir(video.youtube_id)


async def claim_orphans(session: AsyncSession, profile_id: uuid.UUID) -> None:
    """Give the videos and downloads from before profiles existed to a profile."""
    orphans = select(Video.id).where(~exists().where(ProfileVideo.video_id == Video.id))
    for video_id in await session.scalars(orphans):
        await link_video(session, profile_id, video_id)
    await session.execute(
        update(DownloadJob).where(DownloadJob.profile_id.is_(None)).values(profile_id=profile_id)
    )
