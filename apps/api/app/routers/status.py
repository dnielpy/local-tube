from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.connectivity import connectivity

router = APIRouter(prefix="/status", tags=["status"])


class StatusOut(BaseModel):
    online: bool
    reachable: bool
    forced_offline: bool
    checked_at: datetime | None


class StatusUpdate(BaseModel):
    forced_offline: bool


def _status() -> StatusOut:
    return StatusOut(
        online=connectivity.online,
        reachable=connectivity.reachable,
        forced_offline=connectivity.forced_offline,
        checked_at=connectivity.checked_at,
    )


@router.get("", response_model=StatusOut)
async def get_status() -> StatusOut:
    return _status()


@router.put("", response_model=StatusOut)
async def update_status(body: StatusUpdate) -> StatusOut:
    await connectivity.set_forced_offline(body.forced_offline)
    return _status()
