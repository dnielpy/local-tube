from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.db import SessionDep
from app.models import DownloadJob, Profile, WatchEvent
from app.schemas import ActiveDownloadsOut, WatchTimeOut
from app.services.service_auth import ServiceDep
from app.services.worker import ACTIVE_STATUSES

router = APIRouter(prefix="/stats", tags=["stats"], dependencies=[ServiceDep])


@router.get(
    "/downloads/active",
    response_model=ActiveDownloadsOut,
    description="Jobs of every profile that are queued, downloading or processing, oldest first.",
)
async def active_downloads(session: SessionDep) -> ActiveDownloadsOut:
    jobs = list(
        await session.scalars(
            select(DownloadJob)
            .where(DownloadJob.status.in_(ACTIVE_STATUSES))
            .order_by(DownloadJob.created_at)
        )
    )
    return ActiveDownloadsOut(count=len(jobs), items=jobs)


@router.get(
    "/watch-time",
    response_model=list[WatchTimeOut],
    description=(
        "Seconds each profile has played, in the last `hours` or since time started being "
        "recorded when it is left out. Every profile is listed, the one that watched the most "
        "first."
    ),
)
async def watch_time(
    session: SessionDep, hours: Annotated[float | None, Query(gt=0)] = None
) -> list[WatchTimeOut]:
    played = select(WatchEvent.profile_id, func.sum(WatchEvent.seconds).label("seconds"))
    if hours is not None:
        played = played.where(WatchEvent.at >= datetime.now(UTC) - timedelta(hours=hours))
    played = played.group_by(WatchEvent.profile_id).subquery()
    seconds = func.coalesce(played.c.seconds, 0)
    rows = await session.execute(
        select(Profile, seconds)
        .outerjoin(played, played.c.profile_id == Profile.id)
        .order_by(seconds.desc(), Profile.name)
    )
    return [
        WatchTimeOut(
            profile_id=profile.id, name=profile.name, avatar_url=profile.avatar_url, seconds=total
        )
        for profile, total in rows
    ]
