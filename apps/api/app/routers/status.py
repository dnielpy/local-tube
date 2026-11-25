from datetime import datetime

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.services import download_window
from app.services.connectivity import connectivity

router = APIRouter(prefix="/status", tags=["status"])


class StatusOut(BaseModel):
    online: bool
    reachable: bool
    forced_offline: bool
    checked_at: datetime | None
    # Outside the download hours, when queued downloads start again.
    downloads_resume_at: datetime | None
    # Downloads run now even outside the download hours.
    downloads_any_hour: bool


class StatusUpdate(BaseModel):
    forced_offline: bool | None = None
    downloads_any_hour: bool | None = None


def _status() -> StatusOut:
    return StatusOut(
        online=connectivity.online,
        reachable=connectivity.reachable,
        forced_offline=connectivity.forced_offline,
        checked_at=connectivity.checked_at,
        downloads_resume_at=download_window.next_open(),
        downloads_any_hour=download_window.state.any_hour,
    )


@router.get("", response_model=StatusOut)
async def get_status() -> StatusOut:
    return _status()


@router.put("", response_model=StatusOut)
async def update_status(body: StatusUpdate, request: Request) -> StatusOut:
    if body.forced_offline is not None:
        await connectivity.set_forced_offline(body.forced_offline)
    if body.downloads_any_hour is not None:
        await download_window.set_any_hour(body.downloads_any_hour)
        worker = getattr(request.app.state, "worker", None)
        if worker is not None:
            if body.downloads_any_hour:
                worker.notify()
            else:
                worker.close_window()
    return _status()
