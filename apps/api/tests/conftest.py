import os
import shutil
import tempfile
from collections.abc import AsyncIterator, Awaitable, Callable
from pathlib import Path

os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://localtube:localtube@localhost:5442/localtube_test"
)
os.environ["MEDIA_ROOT"] = tempfile.mkdtemp(prefix="localtube-media-")
os.environ["PROFILES_ROOT"] = tempfile.mkdtemp(prefix="localtube-profiles-")
os.environ["WORKER_ENABLED"] = "false"
os.environ["CONNECTIVITY_CHECK"] = "false"

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.config import get_settings
from app.db import SessionLocal, engine
from app.main import app
from app.models import Base, Profile, ProfileStatus, Video
from app.routers.channels import get_channel_service
from app.routers.profiles import get_login
from app.services.browser import BrowserError, BrowserSession
from app.services.channels import ChannelService
from app.services.connectivity import connectivity
from app.services.library import link_video
from app.services.login import LoginService
from app.services.profiles import SESSION_COOKIE, hash_pin, pin_guard, session_token


@pytest.fixture(scope="session", autouse=True)
async def schema() -> AsyncIterator[None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
async def clean_tables() -> AsyncIterator[None]:
    connectivity.reachable = True
    connectivity.forced_offline = False
    pin_guard._attempts.clear()
    shutil.rmtree(get_settings().media_root / ".cache", ignore_errors=True)
    yield
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "TRUNCATE download_jobs, videos, app_settings, channel_videos, channels, "
                "profiles CASCADE"
            )
        )


@pytest.fixture
def media_root() -> Path:
    return get_settings().media_root


@pytest.fixture
def make_profile() -> Callable[..., Awaitable[Profile]]:
    async def factory(
        name: str = "Daniel", pin: str = "1234", status: ProfileStatus = ProfileStatus.ready
    ) -> Profile:
        async with SessionLocal() as session:
            profile = Profile(name=name, pin_hash=hash_pin(pin), status=status)
            session.add(profile)
            await session.commit()
            return profile

    return factory


@pytest.fixture
async def anon_client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def profile(make_profile) -> Profile:
    return await make_profile()


@pytest.fixture
async def client(profile: Profile) -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        c.cookies.set(SESSION_COOKIE, await session_token(profile.id))
        yield c


@pytest.fixture
async def client_for() -> AsyncIterator[Callable[[Profile], Awaitable[AsyncClient]]]:
    clients: list[AsyncClient] = []

    async def factory(profile: Profile) -> AsyncClient:
        c = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
        c.cookies.set(SESSION_COOKIE, await session_token(profile.id))
        clients.append(c)
        return c

    yield factory
    for c in clients:
        await c.aclose()


@pytest.fixture
def make_video(media_root: Path, profile: Profile) -> Callable[..., Awaitable[Video]]:
    async def factory(
        youtube_id: str = "abc123", owners: list[Profile] | None = None, **overrides: object
    ) -> Video:
        directory = media_root / youtube_id
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "video.mp4").write_bytes(bytes(range(256)) * 4)
        (directory / "thumbnail.jpg").write_bytes(b"\xff\xd8\xff fake jpeg")
        fields: dict[str, object] = {
            "youtube_id": youtube_id,
            "title": f"Video {youtube_id}",
            "description": "A description",
            "file_path": f"{youtube_id}/video.mp4",
            "thumbnail_path": f"{youtube_id}/thumbnail.jpg",
            "youtube_url": f"https://www.youtube.com/watch?v={youtube_id}",
            "channel": "Some Channel",
            "duration_seconds": 125,
            "file_size": 1024,
        }
        fields.update(overrides)
        async with SessionLocal() as session:
            video = Video(**fields)
            session.add(video)
            await session.flush()
            for owner in [profile] if owners is None else owners:
                await link_video(session, owner.id, video.id)
            await session.commit()
            return video

    return factory


class FakeYouTube:
    def __init__(self) -> None:
        from app.services.youtube import ChannelPage, RemoteChannel, RemoteVideo

        self.calls: list[str] = []
        self.cookies: list[str | None] = []
        self.subs = [
            RemoteChannel(
                id="UCaaa", name="Alpha", handle="@alpha", avatar_url="https://img/a=s176"
            ),
            RemoteChannel(id="UCbbb", name="beta", handle="@beta", avatar_url="https://img/b=s176"),
        ]
        self.pages = {
            "UCaaa": ChannelPage(
                channel=RemoteChannel(
                    id="UCaaa",
                    name="Alpha",
                    handle="@alpha",
                    description="Alpha channel",
                    subscriber_count=1200,
                    avatar_url="https://img/a=s176",
                    banner_url="https://img/a-banner=w1280",
                ),
                videos=[
                    RemoteVideo(
                        youtube_id=f"vid{i}",
                        title=f"Video {i}",
                        duration_seconds=60 * i,
                        view_count=100 * i,
                        published_at=None,
                        thumbnail_url=f"https://i.ytimg.com/vi/vid{i}/mqdefault.jpg",
                    )
                    for i in range(3)
                ],
            )
        }

    def subscriptions(self, cookies_file=None):
        self.calls.append("subscriptions")
        self.cookies.append(cookies_file)
        return self.subs

    def channel(self, channel_id, limit=10, start=0):
        from app.services.youtube import ChannelPage

        self.calls.append(f"channel:{channel_id}" + (f"@{start}" if start else ""))
        page = self.pages[channel_id]
        return ChannelPage(channel=page.channel, videos=page.videos[start : start + limit])


class FakeFetch:
    def __init__(self) -> None:
        self.urls: list[str] = []

    async def __call__(self, url: str) -> tuple[bytes, str]:
        self.urls.append(url)
        return b"\xff\xd8\xff image " + url.encode(), "image/jpeg"


@pytest.fixture
def youtube() -> FakeYouTube:
    return FakeYouTube()


@pytest.fixture
def fetch() -> FakeFetch:
    return FakeFetch()


@pytest.fixture(autouse=True)
def channel_service(youtube: FakeYouTube, fetch: FakeFetch):
    service = ChannelService(youtube, fetch)
    app.dependency_overrides[get_channel_service] = lambda: service
    yield service
    app.dependency_overrides.pop(get_channel_service, None)


class FakeBrowser:
    COOKIES = "# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSAPISID\tabc\n"

    def __init__(self) -> None:
        self.profile_id = None
        self.running = False
        self.signed_in = False
        self.fail = False
        self.calls: list[str] = []

    async def start(self, profile_id) -> None:
        if self.fail:
            raise BrowserError("connection refused")
        self.calls.append("start")
        self.profile_id, self.running, self.signed_in = profile_id, True, False

    async def session(self) -> BrowserSession:
        if not self.signed_in:
            return BrowserSession(profile_id=self.profile_id, running=self.running)
        return BrowserSession(
            profile_id=self.profile_id,
            running=self.running,
            signed_in=True,
            cookies=self.COOKIES,
            name="Daniel Quesada",
            avatar_url="https://yt3.ggpht.com/photo=s88-c-k",
        )

    async def stop(self) -> None:
        self.calls.append("stop")
        self.running = False


@pytest.fixture(autouse=True)
def browser(channel_service, fetch) -> FakeBrowser:
    fake = FakeBrowser()
    login = LoginService(fake, channel_service, fetch)
    app.dependency_overrides[get_login] = lambda: login
    yield fake
    app.dependency_overrides.pop(get_login, None)
