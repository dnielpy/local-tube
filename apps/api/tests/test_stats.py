from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import update

from app.config import get_settings
from app.db import SessionLocal
from app.models import DownloadJob, JobStatus, WatchEntry, WatchEvent
from app.services.watch_time import played_seconds

TOKEN = {"X-Service-Token": "secret"}
T0 = datetime(2026, 11, 13, 12, 0, tzinfo=UTC)


@pytest.fixture(autouse=True)
def service_token(monkeypatch):
    monkeypatch.setattr(get_settings(), "service_token", "secret")


@pytest.mark.parametrize(
    ("previous", "position", "elapsed", "played"),
    [
        (10, 15, 5, 5),  # playing
        (10, 20, 5, 10),  # playing at 2x
        (10, 15, 3600, 5),  # resuming the next day
        (10, 300, 5, None),  # seek forwards
        (10, 50, 3600, None),  # seek forwards after a pause
        (300, 10, 5, None),  # seek back or watching it again
        (10, 10, 5, None),  # paused
    ],
)
def test_played_seconds(previous, position, elapsed, played):
    assert played_seconds(previous, T0, position, T0 + timedelta(seconds=elapsed)) == played


async def _age_entry(video_id, seconds: float) -> None:
    async with SessionLocal() as session:
        await session.execute(
            update(WatchEntry)
            .where(WatchEntry.video_id == video_id)
            .values(watched_at=datetime.now(UTC) - timedelta(seconds=seconds))
        )
        await session.commit()


async def test_watch_time_adds_up_playback_per_profile(
    client, anon_client, client_for, make_profile, make_video, profile
):
    video = await make_video()
    for position in (0, 5, 10):
        await client.put(f"/api/history/{video.id}", json={"position": position, "duration": 125})
        await _age_entry(video.id, 5)
    # A seek is not counted
    await client.put(f"/api/history/{video.id}", json={"position": 100, "duration": 125})
    idle = await make_profile("Ana")

    body = (await anon_client.get("/api/stats/watch-time", headers=TOKEN)).json()

    assert [(row["name"], row["seconds"]) for row in body] == [(profile.name, 10), (idle.name, 0)]


async def test_watch_time_window(anon_client, profile, make_video):
    video = await make_video()
    async with SessionLocal() as session:
        session.add_all(
            [
                WatchEvent(
                    profile_id=profile.id, video_id=video.id, seconds=5, at=datetime.now(UTC)
                ),
                WatchEvent(
                    profile_id=profile.id,
                    video_id=video.id,
                    seconds=7,
                    at=datetime.now(UTC) - timedelta(hours=3),
                ),
            ]
        )
        await session.commit()

    recent = (await anon_client.get("/api/stats/watch-time?hours=1", headers=TOKEN)).json()
    total = (await anon_client.get("/api/stats/watch-time", headers=TOKEN)).json()

    assert recent[0]["seconds"] == 5
    assert total[0]["seconds"] == 12


async def test_active_downloads_of_every_profile(anon_client, make_profile, profile):
    other = await make_profile("Ana")
    async with SessionLocal() as session:
        session.add_all(
            [
                DownloadJob(
                    url="u1",
                    title="One",
                    status=JobStatus.downloading,
                    progress=40,
                    profile_id=profile.id,
                ),
                DownloadJob(url="u2", title="Two", status=JobStatus.queued, profile_id=other.id),
                DownloadJob(
                    url="u3", title="Done", status=JobStatus.completed, profile_id=profile.id
                ),
            ]
        )
        await session.commit()

    body = (await anon_client.get("/api/stats/downloads/active", headers=TOKEN)).json()

    assert body["count"] == 2
    assert {item["title"] for item in body["items"]} == {"One", "Two"}


async def test_terminal_downloads_of_every_profile(anon_client, make_profile, profile):
    other = await make_profile("Ana")
    async with SessionLocal() as session:
        session.add_all([
            DownloadJob(url="u1", title="Done", status=JobStatus.completed, profile_id=profile.id),
            DownloadJob(url="u2", title="Failed", status=JobStatus.failed, profile_id=other.id),
            DownloadJob(
                url="u3", title="Active", status=JobStatus.downloading, profile_id=other.id
            ),
        ])
        await session.commit()

    since = (datetime.now(UTC) - timedelta(minutes=1)).isoformat()
    response = await anon_client.get(
        "/api/stats/downloads/terminal", params={"since": since}, headers=TOKEN
    )

    assert response.status_code == 200
    assert {job["title"] for job in response.json()} == {"Done", "Failed"}
    assert all(job["updated_at"] for job in response.json())


@pytest.mark.parametrize("headers", [{}, {"X-Service-Token": "wrong"}])
async def test_stats_need_the_service_token(anon_client, headers):
    for path in (
        "/api/stats/watch-time",
        "/api/stats/downloads/active",
        "/api/stats/downloads/terminal?since=2026-11-13T00:00:00Z",
    ):
        assert (await anon_client.get(path, headers=headers)).status_code == 403


async def test_stats_are_closed_without_a_configured_token(anon_client, monkeypatch):
    monkeypatch.setattr(get_settings(), "service_token", None)

    assert (await anon_client.get("/api/stats/watch-time", headers=TOKEN)).status_code == 403
