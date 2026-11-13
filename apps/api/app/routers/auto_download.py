from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, exists, select

from app.db import SessionDep
from app.models import AutoDownloadChannel, Channel, ChannelVideo, DownloadJob, Profile, Video
from app.routers.channels import (
    ServiceDep,
    avatar_url_of,
    channel_choices,
    known_channel_ids,
    remote_videos,
)
from app.schemas import (
    AutoDownloadSettings,
    ChannelChoiceOut,
    ChannelIdsIn,
    ChannelOut,
    PendingVideos,
)
from app.services.connectivity import connectivity
from app.services.library import in_library
from app.services.profiles import ProfileDep
from app.services.worker import ACTIVE_STATUSES
from app.services.youtube import NOT_DOWNLOADABLE, YouTubeError
from app.settings_store import read_setting, write_setting

router = APIRouter(prefix="/auto-download", tags=["auto-download"])


def _settings_key(profile: Profile) -> str:
    return f"auto_download:{profile.id}"


async def read_settings(profile: Profile) -> AutoDownloadSettings:
    stored = await read_setting(_settings_key(profile))
    return AutoDownloadSettings.model_validate_json(stored) if stored else AutoDownloadSettings()


@router.get("/settings", response_model=AutoDownloadSettings)
async def get_settings(profile: ProfileDep) -> AutoDownloadSettings:
    return await read_settings(profile)


@router.put("/settings", response_model=AutoDownloadSettings)
async def put_settings(body: AutoDownloadSettings, profile: ProfileDep) -> AutoDownloadSettings:
    await write_setting(_settings_key(profile), body.model_dump_json())
    return body


async def _channels(session: SessionDep, profile: Profile) -> list[ChannelChoiceOut]:
    enabled = set(
        await session.scalars(
            select(AutoDownloadChannel.channel_id).where(
                AutoDownloadChannel.profile_id == profile.id
            )
        )
    )
    return await channel_choices(session, profile, enabled)


@router.get("/channels", response_model=list[ChannelChoiceOut])
async def list_channels(session: SessionDep, profile: ProfileDep) -> list[ChannelChoiceOut]:
    return await _channels(session, profile)


@router.put("/channels", response_model=list[ChannelChoiceOut])
async def set_channels(
    body: ChannelIdsIn, session: SessionDep, profile: ProfileDep
) -> list[ChannelChoiceOut]:
    known = await known_channel_ids(session, body.channel_ids)
    await session.execute(
        delete(AutoDownloadChannel).where(AutoDownloadChannel.profile_id == profile.id)
    )
    session.add_all(
        AutoDownloadChannel(profile_id=profile.id, channel_id=channel_id) for channel_id in known
    )
    await session.commit()
    return await _channels(session, profile)


@router.get("/channels/{channel_id}/pending", response_model=PendingVideos)
async def pending_videos(
    channel_id: str, session: SessionDep, service: ServiceDep, profile: ProfileDep
) -> PendingVideos:
    """The channel's videos newer than the newest one in the library, up to `per_channel`.

    With no video of the channel in the library yet, only its latest one.
    """
    if not connectivity.online:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, {"message": "Sin conexión"})
    try:
        latest = await service.latest_videos(channel_id, (await read_settings(profile)).per_channel)
    except YouTubeError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, {"message": str(exc)}) from exc

    owned = set(
        await session.scalars(
            select(Video.youtube_id).where(
                Video.youtube_id.in_([video.youtube_id for video in latest]),
                in_library(profile.id),
            )
        )
    )
    newer = []
    for video in latest:
        if video.youtube_id in owned:
            break
        newer.append(video)
    newer = [video for video in newer if video.live_status not in NOT_DOWNLOADABLE]
    if not owned:
        has_any = await session.scalar(
            select(exists().where(Video.channel_id == channel_id, in_library(profile.id)))
        )
        if not has_any:
            newer = newer[:1]

    queued = set(
        await session.scalars(
            select(DownloadJob.youtube_id).where(
                DownloadJob.profile_id == profile.id,
                DownloadJob.youtube_id.in_([video.youtube_id for video in newer]),
                DownloadJob.status.in_(ACTIVE_STATUSES),
            )
        )
    )
    wanted = [video.youtube_id for video in newer if video.youtube_id not in queued]
    stored = {
        video.youtube_id: video
        for video in await session.scalars(
            select(ChannelVideo).where(ChannelVideo.youtube_id.in_(wanted))
        )
    }
    channel = await session.get_one(Channel, channel_id, populate_existing=True)
    return PendingVideos(
        channel=ChannelOut(
            id=channel.id,
            name=channel.name,
            handle=channel.handle,
            avatar_url=avatar_url_of(channel),
        ),
        videos=await remote_videos(
            session, profile, [stored[youtube_id] for youtube_id in wanted if youtube_id in stored]
        ),
    )
