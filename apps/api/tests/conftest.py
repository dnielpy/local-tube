import os
import tempfile
from collections.abc import AsyncIterator, Awaitable, Callable
from pathlib import Path

os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://localtube:localtube@localhost:5442/localtube_test"
)
os.environ["MEDIA_ROOT"] = tempfile.mkdtemp(prefix="localtube-media-")
os.environ["WORKER_ENABLED"] = "false"

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.config import get_settings
from app.db import SessionLocal, engine
from app.main import app
from app.models import Base, Video


@pytest.fixture(scope="session", autouse=True)
async def schema() -> AsyncIterator[None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
async def clean_tables() -> AsyncIterator[None]:
    yield
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE download_jobs, videos CASCADE"))


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
