from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.db import SessionLocal
from app.models import DownloadJob, JobStatus
from app.services.auto_download import _settings_key, pending_videos, ran_on, run_due
from app.services.connectivity import connectivity
from app.services.worker import claim_next_job
from app.services.youtube import RemoteVideo
from app.settings_store import write_setting


def remote(youtube_id: str, live_status: str | None = None) -> RemoteVideo:
    return RemoteVideo(
        youtube_id=youtube_id,
        title=f"Video {youtube_id}",
        duration_seconds=60,
        view_count=None,
        published_at=None,
        thumbnail_url=f"https://i.ytimg.com/vi/{youtube_id}/mqdefault.jpg",
        live_status=live_status,
    )


def set_videos(youtube, *videos: RemoteVideo) -> None:
    youtube.pages["UCaaa"].videos = list(videos)


async def pending(channel_service, profile, per_channel: int = 10) -> list[str]:
    latest = await channel_service.latest_videos("UCaaa", per_channel)
    async with SessionLocal() as session:
        videos = await pending_videos(session, profile.id, "UCaaa", latest)
    return [video.youtube_id for video in videos]


async def enable_channel(client, channel_service) -> None:
    await client.get("/api/channels")
    await channel_service.wait()
    await client.put("/api/auto-download/channels", json={"channel_ids": ["UCaaa"]})


async def jobs(profile) -> list[tuple[str, int | None]]:
    async with SessionLocal() as session:
        rows = await session.scalars(
            select(DownloadJob)
            .where(DownloadJob.profile_id == profile.id)
            .order_by(DownloadJob.created_at, DownloadJob.youtube_id)
        )
        return [(job.youtube_id, job.max_height) for job in rows]


def at(hour: int, minute: int = 0, day: int = 15) -> datetime:
    return datetime(2026, 11, day, hour, minute).astimezone()


async def test_lists_subscriptions_and_saves_the_selection(client, channel_service):
    await client.get("/api/channels")
    await channel_service.wait()

    before = (await client.get("/api/auto-download/channels")).json()
    saved = await client.put(
        "/api/auto-download/channels", json={"channel_ids": ["UCbbb", "UCunknown"]}
    )
    after = (await client.get("/api/auto-download/channels")).json()

    assert [(c["id"], c["enabled"]) for c in before] == [("UCaaa", False), ("UCbbb", False)]
    assert saved.json() == after
    assert [(c["id"], c["enabled"]) for c in after] == [("UCaaa", False), ("UCbbb", True)]


async def test_keeps_listing_enabled_channels_after_unsubscribing(client, youtube, channel_service):
    await client.get("/api/channels")
    await channel_service.wait()
    await client.put("/api/auto-download/channels", json={"channel_ids": ["UCbbb"]})

    youtube.subs = youtube.subs[:1]
    await client.post("/api/channels/sync")
    await channel_service.wait()
    body = (await client.get("/api/auto-download/channels")).json()

    assert [(c["id"], c["subscribed"], c["enabled"]) for c in body] == [
        ("UCaaa", True, False),
        ("UCbbb", False, True),
    ]


async def test_without_videos_of_the_channel_offers_only_the_latest(
    channel_service, profile, youtube
):
    set_videos(youtube, remote("new1"), remote("new2"), remote("new3"))

    assert await pending(channel_service, profile) == ["new1"]


async def test_offers_the_videos_newer_than_the_latest_in_the_library(
    channel_service, profile, youtube, make_video
):
    await make_video("old", channel_id="UCaaa")
    set_videos(youtube, remote("new1"), remote("new2"), remote("old"), remote("older"))

    assert await pending(channel_service, profile) == ["new1", "new2"]


async def test_offers_a_whole_page_when_the_library_only_has_older_videos(
    channel_service, profile, youtube, make_video
):
    await make_video("ancient", channel_id="UCaaa")
    set_videos(youtube, *(remote(f"new{i}") for i in range(12)))

    assert await pending(channel_service, profile) == [f"new{i}" for i in range(10)]


async def test_is_up_to_date_when_the_latest_is_in_the_library(
    channel_service, profile, youtube, make_video
):
    await make_video("new1", channel_id="UCaaa")
    set_videos(youtube, remote("new1"), remote("old"))

    assert await pending(channel_service, profile) == []


async def test_skips_live_streams_premieres_and_queued_downloads(
    channel_service, youtube, make_video, profile
):
    await make_video("old", channel_id="UCaaa")
    set_videos(
        youtube,
        remote("soon", live_status="is_upcoming"),
        remote("live", live_status="is_live"),
        remote("queued"),
        remote("new1", live_status="was_live"),
        remote("old"),
    )
    async with SessionLocal() as session:
        session.add(
            DownloadJob(
                url="https://www.youtube.com/watch?v=queued",
                youtube_id="queued",
                status=JobStatus.queued,
                profile_id=profile.id,
            )
        )
        await session.commit()

    assert await pending(channel_service, profile) == ["new1"]


async def test_settings_have_defaults_and_are_saved(client):
    defaults = (await client.get("/api/auto-download/settings")).json()
    saved = await client.put(
        "/api/auto-download/settings",
        json={"max_height": 720, "start_time": "01:30", "per_channel": 3},
    )
    after = (await client.get("/api/auto-download/settings")).json()

    assert defaults == {"max_height": 480, "start_time": "01:00", "per_channel": 10}
    assert saved.status_code == 200
    assert after == {"max_height": 720, "start_time": "01:30", "per_channel": 3}


async def test_settings_reject_unknown_values(client):
    for body in (
        {"max_height": 500},
        {"start_time": "25:00"},
        {"per_channel": 0},
    ):
        response = await client.put("/api/auto-download/settings", json=body)
        assert response.status_code == 422, body


async def test_queues_at_most_the_videos_per_channel_setting(
    client, channel_service, youtube, make_video, profile
):
    await enable_channel(client, channel_service)
    await make_video("ancient", channel_id="UCaaa")
    set_videos(youtube, *(remote(f"new{i}") for i in range(12)))
    await client.put("/api/auto-download/settings", json={"per_channel": 3})

    await run_due(channel_service, None, at(1))

    assert sorted(await jobs(profile)) == [("new0", 480), ("new1", 480), ("new2", 480)]


async def test_runs_once_a_day_from_its_hour(client, channel_service, youtube, make_video, profile):
    await enable_channel(client, channel_service)
    await make_video("old", channel_id="UCaaa")
    set_videos(youtube, remote("new1"), remote("old"))

    await run_due(channel_service, None, at(0, 59))
    assert await jobs(profile) == []

    await run_due(channel_service, None, at(1))
    assert await jobs(profile) == [("new1", 480)]
    assert await ran_on(profile.id) == at(1).date()

    set_videos(youtube, remote("new2"), remote("new1"), remote("old"))
    await run_due(channel_service, None, at(13))
    assert await jobs(profile) == [("new1", 480)]

    await run_due(channel_service, None, at(1, day=16))
    assert sorted(await jobs(profile)) == [("new1", 480), ("new2", 480)]


async def test_uses_the_saved_hour_and_quality(client, channel_service, youtube, profile):
    await enable_channel(client, channel_service)
    set_videos(youtube, remote("new1"))
    await client.put("/api/auto-download/settings", json={"max_height": 720, "start_time": "06:30"})

    await run_due(channel_service, None, at(6, 29))
    assert await jobs(profile) == []

    await run_due(channel_service, None, at(6, 30))
    assert await jobs(profile) == [("new1", 720)]


async def test_waits_for_the_connection(client, channel_service, youtube, profile):
    await enable_channel(client, channel_service)
    set_videos(youtube, remote("new1"))
    youtube.calls.clear()
    connectivity.forced_offline = True

    await run_due(channel_service, None, at(1))

    assert youtube.calls == []
    assert await ran_on(profile.id) is None

    connectivity.forced_offline = False
    await run_due(channel_service, None, at(2))
    assert await jobs(profile) == [("new1", 480)]


async def test_old_settings_without_an_hour_run_at_one(client, profile):
    await write_setting(
        _settings_key(profile.id), '{"max_height": 480, "start_time": null, "per_channel": 5}'
    )

    body = (await client.get("/api/auto-download/settings")).json()

    assert body == {"max_height": 480, "start_time": "01:00", "per_channel": 5}


async def test_scheduled_downloads_wait_for_their_hour(client):
    later = datetime.now(UTC) + timedelta(hours=2)
    response = await client.post(
        "/api/downloads",
        json={"url": "https://www.youtube.com/watch?v=later", "start_at": later.isoformat()},
    )
    assert response.status_code == 201
    assert response.json()["start_at"] is not None

    assert await claim_next_job() is None

    async with SessionLocal() as session, session.begin():
        job = await session.get(DownloadJob, response.json()["id"])
        job.start_at = datetime.now(UTC) - timedelta(minutes=1)
    claimed = await claim_next_job()
    assert claimed is not None and str(claimed[0]) == response.json()["id"]
