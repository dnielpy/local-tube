import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.dialects.postgresql import insert

from app.db import SessionDep
from app.models import Playlist, PlaylistItem, PlaylistKind, Profile, Video, WatchEntry
from app.schemas import (
    HistoryEntryOut,
    HistoryPage,
    PlaylistDetail,
    PlaylistIn,
    PlaylistItemOut,
    PlaylistOut,
    WatchIn,
)
from app.services.library import in_library
from app.services.profiles import ProfileDep

router = APIRouter(tags=["library"])

SYSTEM_PLAYLISTS = {
    PlaylistKind.watch_later: "Ver más tarde",
    PlaylistKind.liked: "Videos que me gustan",
}


async def _library_video(session: SessionDep, profile: Profile, video_id: uuid.UUID) -> Video:
    video = await session.scalar(select(Video).where(Video.id == video_id, in_library(profile.id)))
    if video is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video not found")
    return video


# History


@router.put("/history/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def record_watch(
    video_id: uuid.UUID, body: WatchIn, session: SessionDep, profile: ProfileDep
) -> None:
    await _library_video(session, profile, video_id)
    values = {
        "watched_at": datetime.now(UTC),
        "position": body.position,
        "duration": body.duration,
    }
    await session.execute(
        insert(WatchEntry)
        .values(profile_id=profile.id, video_id=video_id, **values)
        .on_conflict_do_update(index_elements=["profile_id", "video_id"], set_=values)
    )
    await session.commit()


@router.get("/history", response_model=HistoryPage)
async def history(
    session: SessionDep,
    profile: ProfileDep,
    q: str | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 60,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> HistoryPage:
    query = select(WatchEntry).where(WatchEntry.profile_id == profile.id)
    if q:
        pattern = f"%{q}%"
        query = query.join(Video, Video.id == WatchEntry.video_id).where(
            or_(Video.title.ilike(pattern), Video.channel.ilike(pattern))
        )
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    rows = await session.scalars(
        query.order_by(WatchEntry.watched_at.desc()).limit(limit).offset(offset)
    )
    return HistoryPage(
        items=[HistoryEntryOut.model_validate(row) for row in rows], total=total or 0
    )


@router.delete("/history/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def forget_watch(video_id: uuid.UUID, session: SessionDep, profile: ProfileDep) -> None:
    await session.execute(
        delete(WatchEntry).where(
            WatchEntry.profile_id == profile.id, WatchEntry.video_id == video_id
        )
    )
    await session.commit()


@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
async def clear_history(session: SessionDep, profile: ProfileDep) -> None:
    await session.execute(delete(WatchEntry).where(WatchEntry.profile_id == profile.id))
    await session.commit()


# Playlists


async def _system_playlists(session: SessionDep, profile: Profile) -> None:
    """Every profile has "Ver más tarde" and "Videos que me gustan", like on YouTube."""
    existing = set(
        await session.scalars(
            select(Playlist.kind).where(
                Playlist.profile_id == profile.id, Playlist.kind != PlaylistKind.custom
            )
        )
    )
    missing = [kind for kind in SYSTEM_PLAYLISTS if kind not in existing]
    for kind in missing:
        session.add(Playlist(profile_id=profile.id, name=SYSTEM_PLAYLISTS[kind], kind=kind))
    if missing:
        await session.commit()


async def _get_playlist(session: SessionDep, profile: Profile, playlist_id: uuid.UUID) -> Playlist:
    playlist = await session.get(Playlist, playlist_id)
    if playlist is None or playlist.profile_id != profile.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Playlist not found")
    return playlist


async def _items(session: SessionDep, playlist_id: uuid.UUID) -> list[PlaylistItem]:
    return list(
        await session.scalars(
            select(PlaylistItem)
            .where(PlaylistItem.playlist_id == playlist_id)
            .order_by(PlaylistItem.position)
        )
    )


def _summary(
    playlist: Playlist, items: list[PlaylistItem], contains: bool | None = None
) -> PlaylistOut:
    first = items[0].video if items else None
    return PlaylistOut(
        id=playlist.id,
        name=playlist.name,
        kind=playlist.kind,
        count=len(items),
        thumbnail_url=(
            f"/api/videos/{first.id}/thumbnail" if first and first.thumbnail_path else None
        ),
        updated_at=playlist.updated_at,
        contains=contains,
    )


def _order(playlist: Playlist) -> tuple[int, float]:
    system = list(SYSTEM_PLAYLISTS)
    if playlist.kind in system:
        return system.index(playlist.kind), 0
    return len(system), -playlist.updated_at.timestamp()


@router.get("/playlists", response_model=list[PlaylistOut])
async def list_playlists(
    session: SessionDep, profile: ProfileDep, video_id: uuid.UUID | None = None
) -> list[PlaylistOut]:
    await _system_playlists(session, profile)
    playlists = sorted(
        await session.scalars(select(Playlist).where(Playlist.profile_id == profile.id)),
        key=_order,
    )
    result = []
    for playlist in playlists:
        items = await _items(session, playlist.id)
        contains = any(item.video_id == video_id for item in items) if video_id else None
        result.append(_summary(playlist, items, contains))
    return result


@router.post("/playlists", response_model=PlaylistOut, status_code=status.HTTP_201_CREATED)
async def create_playlist(
    body: PlaylistIn, session: SessionDep, profile: ProfileDep
) -> PlaylistOut:
    playlist = Playlist(profile_id=profile.id, name=body.name, kind=PlaylistKind.custom)
    session.add(playlist)
    await session.commit()
    await session.refresh(playlist)
    return _summary(playlist, [])


@router.get("/playlists/{playlist_id}", response_model=PlaylistDetail)
async def get_playlist(
    playlist_id: uuid.UUID, session: SessionDep, profile: ProfileDep
) -> PlaylistDetail:
    playlist = await _get_playlist(session, profile, playlist_id)
    items = await _items(session, playlist.id)
    return PlaylistDetail(
        **_summary(playlist, items).model_dump(),
        items=[PlaylistItemOut.model_validate(item) for item in items],
        duration_seconds=sum(item.video.duration_seconds or 0 for item in items),
    )


@router.patch("/playlists/{playlist_id}", response_model=PlaylistOut)
async def rename_playlist(
    playlist_id: uuid.UUID, body: PlaylistIn, session: SessionDep, profile: ProfileDep
) -> PlaylistOut:
    playlist = await _get_playlist(session, profile, playlist_id)
    if playlist.kind != PlaylistKind.custom:
        raise HTTPException(status.HTTP_409_CONFLICT, "This playlist cannot be renamed")
    playlist.name = body.name
    await session.commit()
    await session.refresh(playlist)
    return _summary(playlist, await _items(session, playlist.id))


@router.delete("/playlists/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_playlist(playlist_id: uuid.UUID, session: SessionDep, profile: ProfileDep) -> None:
    playlist = await _get_playlist(session, profile, playlist_id)
    if playlist.kind != PlaylistKind.custom:
        raise HTTPException(status.HTTP_409_CONFLICT, "This playlist cannot be deleted")
    await session.delete(playlist)
    await session.commit()


@router.put("/playlists/{playlist_id}/videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def add_to_playlist(
    playlist_id: uuid.UUID, video_id: uuid.UUID, session: SessionDep, profile: ProfileDep
) -> None:
    playlist = await _get_playlist(session, profile, playlist_id)
    await _library_video(session, profile, video_id)
    last = await session.scalar(
        select(func.max(PlaylistItem.position)).where(PlaylistItem.playlist_id == playlist.id)
    )
    result = await session.execute(
        insert(PlaylistItem)
        .values(playlist_id=playlist.id, video_id=video_id, position=(last or 0) + 1)
        .on_conflict_do_nothing()
    )
    if result.rowcount:
        playlist.updated_at = datetime.now(UTC)
    await session.commit()


@router.delete("/playlists/{playlist_id}/videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_playlist(
    playlist_id: uuid.UUID, video_id: uuid.UUID, session: SessionDep, profile: ProfileDep
) -> None:
    playlist = await _get_playlist(session, profile, playlist_id)
    result = await session.execute(
        delete(PlaylistItem).where(
            PlaylistItem.playlist_id == playlist.id, PlaylistItem.video_id == video_id
        )
    )
    if result.rowcount:
        playlist.updated_at = datetime.now(UTC)
    await session.commit()
