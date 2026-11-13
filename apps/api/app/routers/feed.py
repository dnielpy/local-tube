from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, or_, select
from sqlalchemy.dialects.postgresql import distinct_on

from app.db import SessionDep
from app.models import Channel, ChannelVideo, FeedChannel, Profile
from app.routers.channels import (
    ServiceDep,
    avatar_url_of,
    channel_choices,
    known_channel_ids,
    remote_videos,
)
from app.schemas import (
    ChannelChoiceOut,
    ChannelIdsIn,
    ChannelOut,
    FeedItemOut,
    FeedOut,
    FeedSettings,
)
from app.services.channels import feed_task
from app.services.connectivity import connectivity
from app.services.feed import (
    feed_channel_ids,
    feed_refreshed_at,
    read_feed_settings,
    write_feed_settings,
)
from app.services.profiles import ProfileDep
from app.services.youtube import NOT_DOWNLOADABLE

router = APIRouter(prefix="/feed", tags=["feed"])

OLDEST = datetime.min.replace(tzinfo=UTC)


@router.get("/settings", response_model=FeedSettings)
async def get_settings(profile: ProfileDep) -> FeedSettings:
    return await read_feed_settings(profile.id)


@router.put("/settings", response_model=FeedSettings)
async def put_settings(body: FeedSettings, profile: ProfileDep) -> FeedSettings:
    await write_feed_settings(profile.id, body)
    return body


async def _channels(session: SessionDep, profile: Profile) -> list[ChannelChoiceOut]:
    return await channel_choices(session, profile, set(await feed_channel_ids(profile.id)))


@router.get("/channels", response_model=list[ChannelChoiceOut])
async def list_channels(session: SessionDep, profile: ProfileDep) -> list[ChannelChoiceOut]:
    return await _channels(session, profile)


@router.put("/channels", response_model=list[ChannelChoiceOut])
async def set_channels(
    body: ChannelIdsIn, session: SessionDep, service: ServiceDep, profile: ProfileDep
) -> list[ChannelChoiceOut]:
    known = await known_channel_ids(session, body.channel_ids)
    await session.execute(delete(FeedChannel).where(FeedChannel.profile_id == profile.id))
    session.add_all(
        FeedChannel(profile_id=profile.id, channel_id=channel_id) for channel_id in known
    )
    await session.commit()
    # Fetch the channels just added, without asking again for the ones that are fresh.
    await service.schedule_feed(profile.id, due_only=False)
    return await _channels(session, profile)


async def _feed(session: SessionDep, service: ServiceDep, profile: Profile) -> FeedOut:
    channel_ids = await feed_channel_ids(profile.id)
    # The newest video of each channel, leaving out live streams and premieres not out yet.
    latest = list(
        await session.scalars(
            select(ChannelVideo)
            .ext(distinct_on(ChannelVideo.channel_id))
            .where(
                ChannelVideo.channel_id.in_(channel_ids),
                or_(
                    ChannelVideo.live_status.is_(None),
                    ChannelVideo.live_status.not_in(NOT_DOWNLOADABLE),
                ),
            )
            .order_by(ChannelVideo.channel_id, ChannelVideo.position)
        )
    )
    latest.sort(key=lambda video: video.published_at or OLDEST, reverse=True)
    channels = {
        channel.id: channel
        for channel in await session.scalars(select(Channel).where(Channel.id.in_(channel_ids)))
    }
    items = [
        FeedItemOut(
            **remote.model_dump(),
            channel=ChannelOut(
                id=channel.id,
                name=channel.name,
                handle=channel.handle,
                avatar_url=avatar_url_of(channel),
            ),
        )
        for video, remote in zip(latest, await remote_videos(session, profile, latest), strict=True)
        if (channel := channels.get(video.channel_id))
    ]
    return FeedOut(
        online=connectivity.online,
        refreshing=service.is_running(feed_task(profile.id)),
        refreshed_at=await feed_refreshed_at(profile.id),
        channel_count=len(channel_ids),
        items=items,
    )


@router.get("", response_model=FeedOut)
async def get_feed(session: SessionDep, service: ServiceDep, profile: ProfileDep) -> FeedOut:
    await service.schedule_feed(profile.id)
    return await _feed(session, service, profile)


@router.post("/refresh", response_model=FeedOut)
async def refresh_feed(session: SessionDep, service: ServiceDep, profile: ProfileDep) -> FeedOut:
    if not connectivity.online:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, {"message": "Sin conexión"})
    await service.schedule_feed(profile.id, force=True)
    return await _feed(session, service, profile)
