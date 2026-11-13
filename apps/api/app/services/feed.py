import uuid
from datetime import datetime

from sqlalchemy import select

from app.db import SessionLocal
from app.models import FeedChannel
from app.schemas import FeedSettings
from app.settings_store import read_setting, write_setting

FEED_CONCURRENCY = 4
FEED_SWEEP_INTERVAL = 600


def _settings_key(profile_id: uuid.UUID) -> str:
    return f"feed:{profile_id}"


def _refreshed_key(profile_id: uuid.UUID) -> str:
    return f"feed_refreshed_at:{profile_id}"


async def read_feed_settings(profile_id: uuid.UUID) -> FeedSettings:
    stored = await read_setting(_settings_key(profile_id))
    return FeedSettings.model_validate_json(stored) if stored else FeedSettings()


async def write_feed_settings(profile_id: uuid.UUID, settings: FeedSettings) -> None:
    await write_setting(_settings_key(profile_id), settings.model_dump_json())


async def feed_refreshed_at(profile_id: uuid.UUID) -> datetime | None:
    stored = await read_setting(_refreshed_key(profile_id))
    return datetime.fromisoformat(stored) if stored else None


async def mark_feed_refreshed(profile_id: uuid.UUID, at: datetime) -> None:
    await write_setting(_refreshed_key(profile_id), at.isoformat())


async def feed_channel_ids(profile_id: uuid.UUID) -> list[str]:
    async with SessionLocal() as session:
        return list(
            await session.scalars(
                select(FeedChannel.channel_id).where(FeedChannel.profile_id == profile_id)
            )
        )


async def feed_profile_ids() -> list[uuid.UUID]:
    async with SessionLocal() as session:
        return list(await session.scalars(select(FeedChannel.profile_id).distinct()))
