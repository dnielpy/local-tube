import asyncio
import contextlib
import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

import httpx

from app.settings_store import read_setting, write_setting

logger = logging.getLogger(__name__)

FORCED_OFFLINE_KEY = "forced_offline"


def youtube_probe(url: str) -> Callable[[], Awaitable[bool]]:
    async def probe() -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(url)
            return response.status_code < 400
        except httpx.HTTPError:
            return False

    return probe


class Connectivity:
    def __init__(self) -> None:
        self.reachable = False
        self.forced_offline = False
        self.checked_at: datetime | None = None
        self._probe: Callable[[], Awaitable[bool]] | None = None
        self._task: asyncio.Task[None] | None = None

    @property
    def online(self) -> bool:
        return self.reachable and not self.forced_offline

    async def load(self) -> None:
        self.forced_offline = (await read_setting(FORCED_OFFLINE_KEY)) == "true"

    async def start(self, probe: Callable[[], Awaitable[bool]], interval: float) -> None:
        self._probe = probe
        await self.load()
        await self.check()
        self._task = asyncio.create_task(self._loop(interval))

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None

    async def check(self) -> None:
        if self._probe is None:
            return
        reachable = await self._probe()
        if reachable != self.reachable:
            logger.info("youtube is %s", "reachable" if reachable else "unreachable")
        self.reachable = reachable
        self.checked_at = datetime.now(UTC)

    async def set_forced_offline(self, value: bool) -> None:
        await write_setting(FORCED_OFFLINE_KEY, "true" if value else "false")
        self.forced_offline = value
        if not value:
            await self.check()

    async def _loop(self, interval: float) -> None:
        while True:
            await asyncio.sleep(interval)
            try:
                await self.check()
            except Exception:
                logger.exception("connectivity check failed")


connectivity = Connectivity()
