from fastapi import APIRouter
from sqlalchemy import delete, select

from app.db import SessionDep
from app.models import AutoDownloadChannel, Profile
from app.routers.channels import channel_choices, known_channel_ids
from app.schemas import AutoDownloadSettings, ChannelChoiceOut, ChannelIdsIn
from app.services.auto_download import read_settings, write_settings
from app.services.profiles import ProfileDep

router = APIRouter(prefix="/auto-download", tags=["auto-download"])


@router.get("/settings", response_model=AutoDownloadSettings)
async def get_settings(profile: ProfileDep) -> AutoDownloadSettings:
    return await read_settings(profile.id)


@router.put("/settings", response_model=AutoDownloadSettings)
async def put_settings(body: AutoDownloadSettings, profile: ProfileDep) -> AutoDownloadSettings:
    await write_settings(profile.id, body)
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
