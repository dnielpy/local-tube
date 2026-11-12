import uuid

from app.config import get_settings


async def test_health(client):
    response = await client.get("/api/health")
    assert response.json() == {"status": "ok"}


async def test_list_videos_newest_first_with_urls(client, make_video):
    await make_video("first")
    await make_video("second")

    response = await client.get("/api/videos")

    body = response.json()
    assert body["total"] == 2
    assert [v["youtube_id"] for v in body["items"]] == ["second", "first"]
    item = body["items"][0]
    assert item["stream_url"] == f"/api/videos/{item['id']}/stream"
    assert item["thumbnail_url"] == f"/api/videos/{item['id']}/thumbnail"


async def test_list_videos_search_and_channel_filter(client, make_video):
    await make_video("one", title="Learning FastAPI", channel="Dev")
    await make_video("two", title="Cooking pasta", channel="Kitchen")

    by_title = (await client.get("/api/videos", params={"q": "fastapi"})).json()
    by_channel = (await client.get("/api/videos", params={"channel": "Kitchen"})).json()

    assert [v["youtube_id"] for v in by_title["items"]] == ["one"]
    assert [v["youtube_id"] for v in by_channel["items"]] == ["two"]


async def test_list_channels(client, make_video):
    await make_video("one", channel="Dev")
    await make_video("two", channel="Kitchen")
    await make_video("three", channel=None)

    assert (await client.get("/api/videos/channels")).json() == ["Kitchen", "Dev"]


async def test_get_video_not_found(client):
    response = await client.get(f"/api/videos/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_stream_supports_range_requests(client, make_video):
    video = await make_video()

    full = await client.get(f"/api/videos/{video.id}/stream")
    partial = await client.get(f"/api/videos/{video.id}/stream", headers={"Range": "bytes=10-19"})

    assert full.status_code == 200
    assert full.headers["accept-ranges"] == "bytes"
    assert partial.status_code == 206
    assert partial.content == bytes(range(10, 20))
    assert partial.headers["content-range"] == "bytes 10-19/1024"


async def test_thumbnail(client, make_video):
    video = await make_video()

    response = await client.get(f"/api/videos/{video.id}/thumbnail")

    assert response.status_code == 200
    assert response.content.startswith(b"\xff\xd8\xff")


async def test_delete_video_removes_files(client, make_video):
    video = await make_video("gone")
    directory = get_settings().media_root / "gone"
    assert directory.exists()

    response = await client.delete(f"/api/videos/{video.id}")

    assert response.status_code == 204
    assert not directory.exists()
    assert (await client.get(f"/api/videos/{video.id}")).status_code == 404
