"""The hours of the day when downloads may use the network, in the server's time.

Outside them queued downloads wait, and one that is running pauses when they end and continues
from its partial files when they start again. The same start and end means any hour.
"""

from datetime import datetime, time, timedelta

from app.config import get_settings
from app.settings_store import read_setting, write_setting

ANY_HOUR_KEY = "downloads_any_hour"


class _State:
    # Switched on from the downloads page: downloads run now, whatever the hour.
    any_hour = False


state = _State()


async def load() -> None:
    state.any_hour = (await read_setting(ANY_HOUR_KEY)) == "true"


async def set_any_hour(value: bool) -> None:
    await write_setting(ANY_HOUR_KEY, "true" if value else "false")
    state.any_hour = value


def _bounds() -> tuple[time, time]:
    settings = get_settings()
    return (
        time.fromisoformat(settings.download_window_start),
        time.fromisoformat(settings.download_window_end),
    )


def _now() -> datetime:
    return datetime.now().astimezone()


def is_open(now: datetime | None = None) -> bool:
    now = now or _now()
    start, end = _bounds()
    if start == end or state.any_hour:
        return True
    current = now.time().replace(tzinfo=None)
    if start < end:
        return start <= current < end
    # Across midnight, for example 22:00 to 06:00.
    return current >= start or current < end


def _next(at: time, now: datetime) -> datetime:
    candidate = now.replace(hour=at.hour, minute=at.minute, second=0, microsecond=0)
    return candidate if candidate > now else candidate + timedelta(days=1)


def next_open(now: datetime | None = None) -> datetime | None:
    """When downloads may start again, or None while they may."""
    now = now or _now()
    return None if is_open(now) else _next(_bounds()[0], now)


def seconds_until_close(now: datetime | None = None) -> float | None:
    """How long downloads may keep going, or None when they never have to stop."""
    now = now or _now()
    start, end = _bounds()
    if start == end or state.any_hour:
        return None
    return (_next(end, now) - now).total_seconds()
