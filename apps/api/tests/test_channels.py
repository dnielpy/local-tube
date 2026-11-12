from datetime import UTC, datetime, timedelta

from sqlalchemy import update

from app.db import SessionLocal
from app.models import Channel
from app.services.connectivity import connectivity


async def get_channels(client, service):
    first = (await client.get("/api/channels")).json()
    await service.wait()
    return first, (await client.get("/api/channels")).json()


async def get_channel(client, service, channel_id, **params):
    first = await client.get(f"/api/channels/{channel_id}", params=params)
    await service.wait()
    return first, await client.get(f"/api/channels/{channel_id}")


async def test_online_lists_subscriptions_with_cached_avatars(
    client, youtube, fetch, channel_service
):
    first, second = await get_channels(client, channel_service)
    body = second["items"]

    assert first["syncing"] is True
    assert second["syncing"] is False
    assert [c["name"] for c in body] == ["Alpha", "beta"]
    assert [c["handle"] for c in body] == ["@alpha", "@beta"]
    assert all(c["subscribed"] for c in body)
    avatar = await client.get(body[0]["avatar_url"])
    assert avatar.status_code == 200
    assert avatar.content.startswith(b"\xff\xd8\xff")
    assert sorted(fetch.urls) == ["https://img/a=s176", "https://img/b=s176"]


async def test_subscriptions_are_cached_for_a_day(client, youtube, fetch, channel_service):
    await get_channels(client, channel_service)
    await get_channels(client, channel_service)
    assert youtube.calls == ["subscriptions"]
    assert len(fetch.urls) == 2

    await client.post("/api/channels/sync")
    await channel_service.wait()
    assert youtube.calls == ["subscriptions", "subscriptions"]
    assert len(fetch.urls) == 2


async def test_offline_lists_channels_with_downloaded_videos(client, youtube, make_video):
    await make_video("one", channel="Local", channel_id="UClocal")
    await make_video("two", channel="Local", channel_id="UClocal")
    await make_video("three", channel="Legacy")
    connectivity.forced_offline = True

    body = (await client.get("/api/channels")).json()["items"]

    assert youtube.calls == []
    assert {(c["id"], c["name"], c["downloaded_count"]) for c in body} == {
        ("UClocal", "Local", 2),
        (None, "Legacy", 1),
    }


async def test_offline_keeps_the_cached_subscriptions(client, youtube, channel_service):
    _, online = await get_channels(client, channel_service)
    connectivity.forced_offline = True

    offline = (await client.get("/api/channels")).json()

    assert youtube.calls == ["subscriptions"]
    assert offline["syncing"] is False
    assert offline["items"] == online["items"]


async def test_sync_requires_connection(client):
    connectivity.reachable = False
    response = await client.post("/api/channels/sync")
    assert response.status_code == 503


async def test_channel_page_online_has_latest_videos_and_images(
    client, youtube, make_video, channel_service
):
    await make_video("vid1", channel="Alpha", channel_id="UCaaa")

    first, second = await get_channel(client, channel_service, "UCaaa")
    body = second.json()

    assert first.json()["refreshing"] is True
    assert first.json()["known"] is False
    assert body["refreshing"] is False
    assert body["name"] == "Alpha"
    assert body["subscriber_count"] == 1200
    assert [v["youtube_id"] for v in body["latest"]] == ["vid0", "vid1", "vid2"]
    assert body["latest"][1]["video_id"] == body["downloaded"][0]["id"]
    assert body["latest"][0]["video_id"] is None
    assert (await client.get(body["banner_url"])).status_code == 200
    assert (await client.get(body["latest"][0]["thumbnail_url"])).status_code == 200


async def test_channel_page_is_cached_and_refreshable(client, youtube, fetch, channel_service):
    await get_channel(client, channel_service, "UCaaa")
    await get_channel(client, channel_service, "UCaaa")
    assert youtube.calls == ["channel:UCaaa"]
    fetched = len(fetch.urls)

    await get_channel(client, channel_service, "UCaaa", refresh=True)
    assert youtube.calls == ["channel:UCaaa", "channel:UCaaa"]
    assert len(fetch.urls) == fetched


async def test_stale_channel_page_is_refetched(client, youtube, channel_service):
    await get_channel(client, channel_service, "UCaaa")
    async with SessionLocal() as session, session.begin():
        await session.execute(
            update(Channel).values(videos_fetched_at=datetime.now(UTC) - timedelta(hours=7))
        )

    await get_channel(client, channel_service, "UCaaa")

    assert youtube.calls == ["channel:UCaaa", "channel:UCaaa"]


async def test_channel_page_offline_uses_cache_without_latest(client, youtube, channel_service):
    await get_channel(client, channel_service, "UCaaa")
    connectivity.forced_offline = True

    body = (await client.get("/api/channels/UCaaa")).json()

    assert youtube.calls == ["channel:UCaaa"]
    assert body["online"] is False
    assert body["latest"] == []
    assert body["avatar_url"] and body["banner_url"]
    assert (await client.get(body["avatar_url"])).status_code == 200


def with_videos(youtube, count):
    from app.services.youtube import RemoteVideo

    youtube.pages["UCaaa"].videos = [
        RemoteVideo(
            youtube_id=f"vid{i}",
            title=f"Video {i}",
            duration_seconds=60,
            view_count=100,
            published_at=None,
            thumbnail_url=f"https://i.ytimg.com/vi/vid{i}/mqdefault.jpg",
        )
        for i in range(count)
    ]


async def test_channel_videos_load_the_next_pages(client, youtube, make_video, channel_service):
    with_videos(youtube, 25)
    await make_video("vid12", channel="Alpha", channel_id="UCaaa")
    _, first = await get_channel(client, channel_service, "UCaaa")
    assert len(first.json()["latest"]) == 10

    second = (await client.get("/api/channels/UCaaa/videos", params={"offset": 10})).json()
    third = (await client.get("/api/channels/UCaaa/videos", params={"offset": 20})).json()

    assert [v["youtube_id"] for v in second["items"]] == [f"vid{i}" for i in range(10, 20)]
    assert second["has_more"] is True
    assert second["items"][2]["video_id"] is not None
    assert (await client.get(second["items"][0]["thumbnail_url"])).status_code == 200
    assert [v["youtube_id"] for v in third["items"]] == [f"vid{i}" for i in range(20, 25)]
    assert third["has_more"] is False
    latest = (await client.get("/api/channels/UCaaa")).json()["latest"]
    assert [v["youtube_id"] for v in latest] == [f"vid{i}" for i in range(25)]


async def test_channel_videos_already_loaded_are_not_refetched(client, youtube, channel_service):
    with_videos(youtube, 25)
    await get_channel(client, channel_service, "UCaaa")

    await client.get("/api/channels/UCaaa/videos", params={"offset": 10})
    again = (await client.get("/api/channels/UCaaa/videos", params={"offset": 10})).json()

    assert youtube.calls == ["channel:UCaaa", "channel:UCaaa@10"]
    assert len(again["items"]) == 10


async def test_channel_refresh_drops_the_extra_pages(client, youtube, channel_service):
    with_videos(youtube, 25)
    await get_channel(client, channel_service, "UCaaa")
    await client.get("/api/channels/UCaaa/videos", params={"offset": 10})

    _, refreshed = await get_channel(client, channel_service, "UCaaa", refresh=True)

    assert len(refreshed.json()["latest"]) == 10


async def test_channel_videos_need_a_connection(client, channel_service):
    await get_channel(client, channel_service, "UCaaa")
    connectivity.forced_offline = True

    response = await client.get("/api/channels/UCaaa/videos", params={"offset": 10})

    assert response.status_code == 503


async def test_offline_channel_refresh_is_rejected(client):
    connectivity.forced_offline = True
    response = await client.get("/api/channels/UCaaa", params={"refresh": True})
    assert response.status_code == 503


async def test_unknown_channel_offline_is_not_found(client):
    connectivity.forced_offline = True
    assert (await client.get("/api/channels/UCnope")).status_code == 404


async def test_downloaded_videos_carry_the_cached_channel_avatar(
    client, make_video, channel_service
):
    await make_video("vid1", channel="Alpha", channel_id="UCaaa")
    await get_channel(client, channel_service, "UCaaa")
    connectivity.forced_offline = True

    video = (await client.get("/api/videos")).json()["items"][0]

    assert video["channel_avatar_url"].startswith("/api/channels/UCaaa/avatar")
    assert (await client.get(video["channel_avatar_url"])).status_code == 200


async def test_channel_media_is_cached_for_downloaded_videos(
    client, youtube, make_video, channel_service
):
    await make_video("vid1", channel="Alpha", channel_id="UCaaa")

    await channel_service.ensure_downloaded_channels_media()

    assert youtube.calls == ["channel:UCaaa"]
    video = (await client.get("/api/videos")).json()["items"][0]
    assert (await client.get(video["channel_avatar_url"])).status_code == 200


async def test_channel_media_is_not_refetched_when_cached(
    client, youtube, make_video, channel_service
):
    await make_video("vid1", channel="Alpha", channel_id="UCaaa")
    await channel_service.ensure_downloaded_channels_media()

    await channel_service.ensure_downloaded_channels_media()

    assert youtube.calls == ["channel:UCaaa"]


async def test_missing_avatar_file_is_downloaded_again(
    client, youtube, make_video, channel_service, media_root
):
    await make_video("vid1", channel="Alpha", channel_id="UCaaa")
    await channel_service.ensure_downloaded_channels_media()
    for avatar in (media_root / ".cache" / "avatars").iterdir():
        avatar.unlink()

    await channel_service.ensure_downloaded_channels_media()

    assert youtube.calls == ["channel:UCaaa", "channel:UCaaa"]
    video = (await client.get("/api/videos")).json()["items"][0]
    assert (await client.get(video["channel_avatar_url"])).status_code == 200


async def test_channel_media_waits_for_a_connection(youtube, make_video, channel_service):
    await make_video("vid1", channel="Alpha", channel_id="UCaaa")
    connectivity.forced_offline = True

    await channel_service.ensure_downloaded_channels_media()

    assert youtube.calls == []
