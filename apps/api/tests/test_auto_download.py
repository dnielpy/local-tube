from datetime import UTC, datetime, timedelta

from app.db import SessionLocal
from app.models import DownloadJob, JobStatus
from app.services.connectivity import connectivity
from app.services.worker import claim_next_job
from app.services.youtube import RemoteVideo


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


async def pending(client) -> list[str]:
    response = await client.get("/api/auto-download/channels/UCaaa/pending")
    assert response.status_code == 200, response.text
    return [video["youtube_id"] for video in response.json()["videos"]]


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


async def test_without_videos_of_the_channel_offers_only_the_latest(client, youtube):
    set_videos(youtube, remote("new1"), remote("new2"), remote("new3"))

    assert await pending(client) == ["new1"]


async def test_offers_the_videos_newer_than_the_latest_in_the_library(client, youtube, make_video):
    await make_video("old", channel_id="UCaaa")
    set_videos(youtube, remote("new1"), remote("new2"), remote("old"), remote("older"))

    body = (await client.get("/api/auto-download/channels/UCaaa/pending")).json()

    assert [video["youtube_id"] for video in body["videos"]] == ["new1", "new2"]
    assert body["channel"]["name"] == "Alpha"
    assert body["videos"][0]["thumbnail_url"] == "/api/channel-videos/new1/thumbnail"


async def test_offers_a_whole_page_when_the_library_only_has_older_videos(
    client, youtube, make_video
):
    await make_video("ancient", channel_id="UCaaa")
    set_videos(youtube, *(remote(f"new{i}") for i in range(12)))

    assert await pending(client) == [f"new{i}" for i in range(10)]


async def test_is_up_to_date_when_the_latest_is_in_the_library(client, youtube, make_video):
    await make_video("new1", channel_id="UCaaa")
    set_videos(youtube, remote("new1"), remote("old"))

    assert await pending(client) == []


async def test_skips_live_streams_premieres_and_queued_downloads(
    client, youtube, make_video, profile
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

    assert await pending(client) == ["new1"]


async def test_pending_needs_a_connection(client, youtube):
    connectivity.forced_offline = True

    response = await client.get("/api/auto-download/channels/UCaaa/pending")

    assert response.status_code == 503
    assert youtube.calls == []


async def test_settings_have_defaults_and_are_saved(client):
    defaults = (await client.get("/api/auto-download/settings")).json()
    saved = await client.put(
        "/api/auto-download/settings",
        json={"max_height": 720, "start_time": "01:30", "per_channel": 3},
    )
    after = (await client.get("/api/auto-download/settings")).json()

    assert defaults == {"max_height": 480, "start_time": None, "per_channel": 10}
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


async def test_offers_at_most_the_videos_per_channel_setting(client, youtube, make_video):
    await make_video("ancient", channel_id="UCaaa")
    set_videos(youtube, *(remote(f"new{i}") for i in range(12)))
    await client.put("/api/auto-download/settings", json={"per_channel": 3})

    assert await pending(client) == ["new0", "new1", "new2"]


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
