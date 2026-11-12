from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.db import SessionLocal
from app.models import AppSetting


async def read_setting(key: str) -> str | None:
    async with SessionLocal() as session:
        return await session.scalar(select(AppSetting.value).where(AppSetting.key == key))


async def write_setting(key: str, value: str) -> None:
    async with SessionLocal() as session, session.begin():
        await session.execute(
            insert(AppSetting)
            .values(key=key, value=value)
            .on_conflict_do_update(index_elements=[AppSetting.key], set_={"value": value})
        )
