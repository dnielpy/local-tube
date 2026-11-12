import asyncio
import logging
import os
import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import Profile, ProfileStatus
from app.services.browser import Browser, BrowserError
from app.services.channels import ChannelService
from app.services.image_cache import ImageFetcher, cache_image, http_fetch
from app.services.library import claim_orphans
from app.services.profiles import profile_dir
from app.services.youtube import sized_image

logger = logging.getLogger(__name__)


class LoginState(StrEnum):
    waiting = "waiting"
    ready = "ready"
    idle = "idle"


class LoginService:
    """Signs a profile in to YouTube through the browser container, one profile at a time."""

    def __init__(
        self, browser: Browser, channels: ChannelService, fetch: ImageFetcher = http_fetch
    ) -> None:
        self.browser = browser
        self.channels = channels
        self.fetch = fetch
        self.active: uuid.UUID | None = None
        self._lock = asyncio.Lock()

    async def start(self, profile_id: uuid.UUID) -> None:
        async with self._lock:
            await self.browser.start(profile_id)
            self.active = profile_id

    async def cancel(self, profile_id: uuid.UUID) -> None:
        async with self._lock:
            if self.active != profile_id:
                return
            self.active = None
            try:
                await self.browser.stop()
            except BrowserError as exc:
                logger.warning("could not close the browser: %s", exc)

    async def poll(self, profile_id: uuid.UUID) -> LoginState:
        async with self._lock:
            if self.active != profile_id:
                return LoginState.idle
            session = await self.browser.session()
            if session.profile_id != profile_id or not session.running:
                self.active = None
                return LoginState.idle
            if not session.signed_in or not session.cookies:
                return LoginState.waiting
            await self._finish(profile_id, session.cookies, session.name, session.avatar_url)
            self.active = None
            try:
                await self.browser.stop()
            except BrowserError as exc:
                logger.warning("could not close the browser: %s", exc)
        await self.channels.schedule_subscriptions(profile_id, force=True)
        return LoginState.ready

    async def _finish(
        self, profile_id: uuid.UUID, cookies: str, name: str | None, avatar_url: str | None
    ) -> None:
        directory = profile_dir(profile_id)
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / "cookies.txt"
        temporary = path.with_suffix(".tmp")
        temporary.write_text(cookies)
        os.chmod(temporary, 0o600)
        temporary.replace(path)

        async with SessionLocal() as session:
            profile = await session.get_one(Profile, profile_id)
            profile.avatar_path = await cache_image(
                sized_image(avatar_url, "s176"),
                "profiles",
                str(profile_id),
                self.fetch,
                profile.avatar_path,
            )
            profile.youtube_name = name or profile.youtube_name
            profile.signed_in_at = datetime.now(UTC)
            if profile.status == ProfileStatus.pending:
                ready = await session.scalar(
                    select(func.count())
                    .select_from(Profile)
                    .where(Profile.status == ProfileStatus.ready)
                )
                profile.status = ProfileStatus.ready
                if not ready:
                    await claim_orphans(session, profile_id)
            await session.commit()
