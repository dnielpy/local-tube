from collections.abc import Iterable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select

from app.db import SessionDep
from app.media import media_path
from app.models import Channel, ChannelVideo, Profile, ProfileSubscription, ProfileVideo, Video
from app.schemas import (
    ChannelChoiceOut,
    ChannelDetail,
    ChannelList,
    ChannelOut,
    RemoteVideoOut,
    RemoteVideoPage,
    VideoOut,
)
from app.services.channels import PAGE_SIZE, ChannelService
from app.services.connectivity import connectivity
from app.services.library import in_library
from app.services.profiles import ProfileDep
from app.services.youtube import YouTubeError

router = APIRouter(tags=["channels"])

CACHE_HEADERS = {"Cache-Control": "public, max-age=604800"}


def get_channel_service(request: Request) -> ChannelService:
    return request.app.state.channel_service


ServiceDep = Annotated[ChannelService, Depends(get_channel_service)]


def avatar_url_of(channel: Channel | None) -> str | None:
    return channel.avatar_url if channel else None


async def _subscribed_ids(session: SessionDep, profile: Profile) -> set[str]:
    rows = await session.scalars(
        select(ProfileSubscription.channel_id).where(ProfileSubscription.profile_id == profile.id)
    )
    return set(rows)


async def _downloaded_channels(session: SessionDep, profile: Profile) -> list[ChannelOut]:
    rows = await session.execute(
        select(
            Video.channel_id,
            func.max(Video.channel),
            func.count(),
            func.max(ProfileVideo.created_at),
        )
        .join(ProfileVideo, ProfileVideo.video_id == Video.id)
        .where(ProfileVideo.profile_id == profile.id, Video.channel.is_not(None))
        .group_by(Video.channel_id, Video.channel)
        .order_by(func.max(ProfileVideo.created_at).desc())
    )
    subscribed = await _subscribed_ids(session, profile)
    result = []
    for channel_id, name, count, _ in rows:
        channel = await session.get(Channel, channel_id) if channel_id else None
        result.append(
            ChannelOut(
                id=channel_id,
                name=channel.name if channel else name,
                handle=channel.handle if channel else None,
                subscribed=channel_id in subscribed,
                downloaded_count=count,
                avatar_url=avatar_url_of(channel),
            )
        )
    return result


async def subscribed_channels(session: SessionDep, profile: Profile) -> list[ChannelOut]:
    counts = dict(
        (
            await session.execute(
                select(Video.channel_id, func.count())
                .where(Video.channel_id.is_not(None), in_library(profile.id))
                .group_by(Video.channel_id)
            )
        ).all()
    )
    channels = await session.scalars(
        select(Channel)
        .join(ProfileSubscription, ProfileSubscription.channel_id == Channel.id)
        .where(ProfileSubscription.profile_id == profile.id)
        .order_by(ProfileSubscription.rank, func.lower(Channel.name))
    )
    return [
        ChannelOut(
            id=channel.id,
            name=channel.name,
            handle=channel.handle,
            subscribed=True,
            downloaded_count=counts.get(channel.id, 0),
            avatar_url=avatar_url_of(channel),
        )
        for channel in channels
    ]


async def channel_choices(
    session: SessionDep, profile: Profile, enabled: set[str]
) -> list[ChannelChoiceOut]:
    """The profile's subscriptions, each marked as enabled or not, to pick from."""
    subscribed = await subscribed_channels(session, profile)
    listed = {channel.id for channel in subscribed}
    # Channels still enabled after unsubscribing stay listed, so they can be turned off.
    others = await session.scalars(
        select(Channel).where(Channel.id.in_(enabled - listed)).order_by(Channel.name)
    )
    return [
        ChannelChoiceOut(**channel.model_dump(), enabled=channel.id in enabled)
        for channel in subscribed
    ] + [
        ChannelChoiceOut(
            id=channel.id,
            name=channel.name,
            handle=channel.handle,
            avatar_url=avatar_url_of(channel),
            enabled=True,
        )
        for channel in others
    ]


async def known_channel_ids(session: SessionDep, channel_ids: Iterable[str]) -> set[str]:
    return set(await session.scalars(select(Channel.id).where(Channel.id.in_(set(channel_ids)))))


async def _channel_list(session: SessionDep, profile: Profile, syncing: bool) -> ChannelList:
    subscribed = await subscribed_channels(session, profile)
    if subscribed:
        return ChannelList(syncing=syncing, items=subscribed)
    return ChannelList(syncing=syncing, items=await _downloaded_channels(session, profile))


@router.get("/channels", response_model=ChannelList)
async def list_channels(
    session: SessionDep, service: ServiceDep, profile: ProfileDep
) -> ChannelList:
    syncing = await service.schedule_subscriptions(profile.id)
    return await _channel_list(session, profile, syncing)


@router.post("/channels/sync", response_model=ChannelList)
async def sync_channels(
    session: SessionDep, service: ServiceDep, profile: ProfileDep
) -> ChannelList:
    if not connectivity.online:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, {"message": "Sin conexión"})
    syncing = await service.schedule_subscriptions(profile.id, force=True)
    return await _channel_list(session, profile, syncing)


async def remote_videos(
    session: SessionDep, profile: Profile, videos: Iterable[ChannelVideo]
) -> list[RemoteVideoOut]:
    remote = list(videos)
    local = dict(
        (
            await session.execute(
                select(Video.youtube_id, Video.id).where(
                    Video.youtube_id.in_([video.youtube_id for video in remote]),
                    in_library(profile.id),
                )
            )
        ).all()
    )
    return [
        RemoteVideoOut(
            youtube_id=video.youtube_id,
            title=video.title,
            duration_seconds=video.duration_seconds,
            view_count=video.view_count,
            published_at=video.published_at,
            thumbnail_url=(
                f"/api/channel-videos/{video.youtube_id}/thumbnail"
                if video.thumbnail_path
                else None
            ),
            youtube_url=f"https://www.youtube.com/watch?v={video.youtube_id}",
            video_id=local.get(video.youtube_id),
        )
        for video in remote
    ]


@router.get("/channels/{channel_id}", response_model=ChannelDetail)
async def get_channel(
    channel_id: str,
    session: SessionDep,
    service: ServiceDep,
    profile: ProfileDep,
    refresh: bool = False,
) -> ChannelDetail:
    if refresh and not connectivity.online:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, {"message": "Sin conexión"})
    refreshing = await service.schedule_channel(channel_id, force=refresh)

    channel = await session.get(Channel, channel_id, populate_existing=True)
    downloaded = list(
        await session.scalars(
            select(Video)
            .join(ProfileVideo, ProfileVideo.video_id == Video.id)
            .where(Video.channel_id == channel_id, ProfileVideo.profile_id == profile.id)
            .order_by(ProfileVideo.created_at.desc())
        )
    )
    if channel is None and not downloaded and not refreshing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Channel not found")

    latest: list[RemoteVideoOut] = []
    if connectivity.online and channel is not None:
        latest = await remote_videos(
            session,
            profile,
            await session.scalars(
                select(ChannelVideo)
                .where(ChannelVideo.channel_id == channel_id)
                .order_by(ChannelVideo.position)
            ),
        )

    return ChannelDetail(
        id=channel_id,
        known=channel is not None,
        refreshing=refreshing,
        name=(
            channel.name
            if channel
            else (downloaded[0].channel if downloaded else None) or channel_id
        ),
        handle=channel.handle if channel else None,
        description=channel.description if channel else None,
        subscriber_count=channel.subscriber_count if channel else None,
        subscribed=channel_id in await _subscribed_ids(session, profile),
        avatar_url=avatar_url_of(channel),
        banner_url=(
            f"/api/channels/{channel_id}/banner?v={channel.banner_path.rsplit('-', 1)[-1]}"
            if channel and channel.banner_path
            else None
        ),
        youtube_url=f"https://www.youtube.com/channel/{channel_id}",
        online=connectivity.online,
        latest=latest,
        latest_fetched_at=channel.videos_fetched_at if channel else None,
        downloaded=[VideoOut.model_validate(video) for video in downloaded],
    )


@router.get("/channels/{channel_id}/videos", response_model=RemoteVideoPage)
async def channel_videos(
    channel_id: str,
    session: SessionDep,
    service: ServiceDep,
    profile: ProfileDep,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> RemoteVideoPage:
    if not connectivity.online:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, {"message": "Sin conexión"})
    if await session.get(Channel, channel_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Channel not found")
    try:
        has_more = await service.load_videos(channel_id, offset)
    except YouTubeError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, {"message": str(exc)}) from exc
    items = await remote_videos(
        session,
        profile,
        await session.scalars(
            select(ChannelVideo)
            .where(ChannelVideo.channel_id == channel_id, ChannelVideo.position >= offset)
            .order_by(ChannelVideo.position)
            .limit(PAGE_SIZE)
        ),
    )
    return RemoteVideoPage(items=items, has_more=has_more)


def _cached_file(relative: str | None) -> FileResponse:
    if not relative or not media_path(relative).is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not cached")
    return FileResponse(media_path(relative), headers=CACHE_HEADERS)


@router.get("/channels/{channel_id}/avatar")
async def channel_avatar(channel_id: str, session: SessionDep) -> FileResponse:
    channel = await session.get(Channel, channel_id)
    return _cached_file(channel.avatar_path if channel else None)


@router.get("/channels/{channel_id}/banner")
async def channel_banner(channel_id: str, session: SessionDep) -> FileResponse:
    channel = await session.get(Channel, channel_id)
    return _cached_file(channel.banner_path if channel else None)


@router.get("/channel-videos/{youtube_id}/thumbnail")
async def channel_video_thumbnail(youtube_id: str, session: SessionDep) -> FileResponse:
    video = await session.get(ChannelVideo, youtube_id)
    return _cached_file(video.thumbnail_path if video else None)
