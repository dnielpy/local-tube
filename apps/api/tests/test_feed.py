from datetime import UTC, datetime, timedelta

from sqlalchemy import update

from app.db import SessionLocal
from app.models import Channel
from app.services.connectivity import connectivity
from app.services.feed import mark_feed_refreshed
from app.services.youtube import ChannelPage, RemoteChannel, RemoteVideo


def remote(youtube_id: str, days_ago: int = 0, live_status: str | None = None) -> RemoteVideo:
    return RemoteVideo(
        youtube_id=youtube_id,
        title=f"Video {youtube_id}",
        duration_seconds=60,
        view_count=None,
        published_at=datetime.now(UTC) - timedelta(days=days_ago),
        thumbnail_url=f"https://i.ytimg.com/vi/{youtube_id}/mqdefault.jpg",
        live_status=live_status,
    )


async def subscribe(client, channel_service) -> None:
    await client.get("/api/channels")
    await channel_service.wait()


async def use_feed(client, channel_service, *channel_ids: str) -> None:
    await subscribe(client, channel_service)
    response = await client.put("/api/feed/channels", json={"channel_ids": list(channel_ids)})
    assert response.status_code == 200, response.text
    await channel_service.wait()


def set_pages(youtube) -> None:
    youtube.pages["UCaaa"].videos = [remote("a1", days_ago=3), remote("a0", days_ago=5)]
    youtube.pages["UCbbb"] = ChannelPage(
        channel=RemoteChannel(id="UCbbb", name="beta", avatar_url="https://img/b=s176"),
        videos=[remote("b1", days_ago=1), remote("b0", days_ago=4)],
    )


async def test_lists_subscriptions_and_saves_the_selection(client, channel_service):
    await subscribe(client, channel_service)

    before = (await client.get("/api/feed/channels")).json()
    saved = await client.put("/api/feed/channels", json={"channel_ids": ["UCbbb", "UCunknown"]})
    after = (await client.get("/api/feed/channels")).json()

    assert [(c["id"], c["enabled"]) for c in before] == [("UCaaa", False), ("UCbbb", False)]
    assert saved.json() == after
    assert [(c["id"], c["enabled"]) for c in after] == [("UCaaa", False), ("UCbbb", True)]


async def test_shows_the_latest_video_of_each_channel_newest_first(
    client, youtube, channel_service
):
    set_pages(youtube)
    await use_feed(client, channel_service, "UCaaa", "UCbbb")

    body = (await client.get("/api/feed")).json()

    assert body["channel_count"] == 2
    assert body["refreshing"] is False
    assert body["refreshed_at"] is not None
    assert [(item["youtube_id"], item["channel"]["name"]) for item in body["items"]] == [
        ("b1", "beta"),
        ("a1", "Alpha"),
    ]
    assert body["items"][0]["thumbnail_url"] == "/api/channel-videos/b1/thumbnail"
    assert body["items"][0]["video_id"] is None


async def test_marks_the_videos_already_downloaded(client, youtube, channel_service, make_video):
    set_pages(youtube)
    video = await make_video("a1", channel_id="UCaaa")
    await use_feed(client, channel_service, "UCaaa")

    body = (await client.get("/api/feed")).json()

    assert [(item["youtube_id"], item["video_id"]) for item in body["items"]] == [
        ("a1", str(video.id))
    ]


async def test_skips_premieres_and_live_streams(client, youtube, channel_service):
    youtube.pages["UCaaa"].videos = [
        remote("soon", live_status="is_upcoming"),
        remote("live", live_status="is_live"),
        remote("done", days_ago=1, live_status="was_live"),
    ]
    await use_feed(client, channel_service, "UCaaa")

    body = (await client.get("/api/feed")).json()

    assert [item["youtube_id"] for item in body["items"]] == ["done"]


async def test_saving_the_channels_fetches_only_the_ones_not_fresh(
    client, youtube, channel_service
):
    set_pages(youtube)
    await subscribe(client, channel_service)
    await client.get("/api/channels/UCaaa")
    await channel_service.wait()
    youtube.calls.clear()

    await use_feed(client, channel_service, "UCaaa", "UCbbb")

    assert youtube.calls == ["channel:UCbbb"]


async def test_is_refreshed_again_once_the_interval_passes(
    client, youtube, channel_service, profile
):
    set_pages(youtube)
    await use_feed(client, channel_service, "UCaaa")
    youtube.calls.clear()

    await client.get("/api/feed")
    await channel_service.wait()
    assert youtube.calls == []

    long_ago = datetime.now(UTC) - timedelta(hours=7)
    await mark_feed_refreshed(profile.id, long_ago)
    async with SessionLocal() as session, session.begin():
        await session.execute(update(Channel).values(videos_fetched_at=long_ago))
    youtube.pages["UCaaa"].videos.insert(0, remote("a2"))

    await client.get("/api/feed")
    await channel_service.wait()
    body = (await client.get("/api/feed")).json()

    assert youtube.calls == ["channel:UCaaa"]
    assert [item["youtube_id"] for item in body["items"]] == ["a2"]


async def test_follows_the_chosen_interval(client, youtube, channel_service, profile):
    set_pages(youtube)
    await client.put("/api/feed/settings", json={"refresh_hours": 1})
    await use_feed(client, channel_service, "UCaaa")
    youtube.calls.clear()

    two_hours_ago = datetime.now(UTC) - timedelta(hours=2)
    await mark_feed_refreshed(profile.id, two_hours_ago)
    async with SessionLocal() as session, session.begin():
        await session.execute(update(Channel).values(videos_fetched_at=two_hours_ago))
    await client.get("/api/feed")
    await channel_service.wait()

    assert youtube.calls == ["channel:UCaaa"]


async def test_refresh_asks_youtube_again_even_when_fresh(client, youtube, channel_service):
    set_pages(youtube)
    await use_feed(client, channel_service, "UCaaa", "UCbbb")
    youtube.calls.clear()

    response = await client.post("/api/feed/refresh")
    await channel_service.wait()

    assert response.status_code == 200
    assert response.json()["refreshing"] is True
    assert sorted(youtube.calls) == ["channel:UCaaa", "channel:UCbbb"]


async def test_refresh_needs_a_connection(client, youtube, channel_service):
    await use_feed(client, channel_service, "UCaaa")
    youtube.calls.clear()
    connectivity.forced_offline = True

    response = await client.post("/api/feed/refresh")
    feed = (await client.get("/api/feed")).json()

    assert response.status_code == 503
    assert feed["online"] is False
    assert youtube.calls == []


async def test_without_channels_the_feed_is_empty_and_never_asks_youtube(client, youtube):
    body = (await client.get("/api/feed")).json()

    assert body["channel_count"] == 0
    assert body["items"] == []
    assert body["refreshing"] is False
    assert youtube.calls == []


async def test_settings_have_defaults_and_are_validated(client):
    defaults = (await client.get("/api/feed/settings")).json()
    invalid = await client.put("/api/feed/settings", json={"refresh_hours": 5})
    saved = await client.put("/api/feed/settings", json={"refresh_hours": 12})
    after = (await client.get("/api/feed/settings")).json()

    assert defaults == {"refresh_hours": 6}
    assert invalid.status_code == 422
    assert saved.status_code == 200
    assert after == {"refresh_hours": 12}


async def test_the_feed_belongs_to_each_profile(client, channel_service, make_profile, client_for):
    await use_feed(client, channel_service, "UCaaa")
    other = await client_for(await make_profile("Ana"))

    body = (await other.get("/api/feed")).json()

    assert body["channel_count"] == 0
