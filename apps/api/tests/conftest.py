import os
import shutil
import tempfile
from collections.abc import AsyncIterator, Awaitable, Callable
from pathlib import Path

os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://localtube:localtube@localhost:5442/localtube_test"
)
os.environ["MEDIA_ROOT"] = tempfile.mkdtemp(prefix="localtube-media-")
os.environ["WORKER_ENABLED"] = "false"
os.environ["CONNECTIVITY_CHECK"] = "false"

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.config import get_settings
from app.db import SessionLocal, engine
from app.main import app
from app.models import Base, Video
from app.routers.channels import get_channel_service
from app.services.channels import ChannelService
from app.services.connectivity import connectivity


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
    shutil.rmtree(get_settings().media_root / ".cache", ignore_errors=True)
    yield
    async with engine.begin() as conn:
        await conn.execute(
            text("TRUNCATE download_jobs, videos, app_settings, channel_videos, channels CASCADE")
        )


@pytest.fixture
def media_root() -> Path:
    return get_settings().media_root


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
def make_video(media_root: Path) -> Callable[..., Awaitable[Video]]:
    async def factory(youtube_id: str = "abc123", **overrides: object) -> Video:
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
            await session.commit()
            return video

    return factory


class FakeYouTube:
    def __init__(self) -> None:
        from app.services.youtube import ChannelPage, RemoteChannel, RemoteVideo

        self.calls: list[str] = []
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

    def subscriptions(self):
        self.calls.append("subscriptions")
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
