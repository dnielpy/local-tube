from app.db import SessionLocal
from app.models import DownloadJob, Video
from app.services.library import claim_orphans, link_video
from app.services.profiles import cookies_path, profile_dir
from app.services.worker import DownloadWorker
from tests.test_downloads import URL, FakeDownloader


async def test_each_profile_sees_only_its_library(client, client_for, make_profile, make_video):
    other = await make_profile("Luis")
    await make_video("mine")
    await make_video("theirs", owners=[other])
    await make_video("shared", owners=[other], channel="Shared")

    mine = (await client.get("/api/videos")).json()
    theirs = (await (await client_for(other)).get("/api/videos")).json()

    assert [v["youtube_id"] for v in mine["items"]] == ["mine"]
    assert sorted(v["youtube_id"] for v in theirs["items"]) == ["shared", "theirs"]
    assert (await client.get(f"/api/videos/{theirs['items'][0]['id']}")).status_code == 404


async def test_video_from_another_library_is_linked_without_downloading(
    client, make_profile, make_video
):
    other = await make_profile("Luis")
    video = await make_video("dQw4w9WgXcQ", owners=[other])

    response = await client.post("/api/downloads", json={"url": URL})

    assert response.status_code == 201
    assert response.json()["status"] == "completed"
    assert response.json()["video_id"] == str(video.id)
    assert [v["id"] for v in (await client.get("/api/videos")).json()["items"]] == [str(video.id)]


async def test_deleting_a_shared_video_keeps_the_file_for_the_others(
    client, client_for, make_profile, make_video, media_root
):
    other = await make_profile("Luis")
    video = await make_video("shared")
    async with SessionLocal() as session, session.begin():
        await link_video(session, other.id, video.id)

    await client.delete(f"/api/videos/{video.id}")

    assert (media_root / "shared").exists()
    assert (await client.get("/api/videos")).json()["total"] == 0
    other_client = await client_for(other)
    assert (await other_client.get(f"/api/videos/{video.id}")).status_code == 200

    await other_client.delete(f"/api/videos/{video.id}")

    assert not (media_root / "shared").exists()
    async with SessionLocal() as session:
        assert await session.get(Video, video.id) is None


async def test_downloads_are_private_to_each_profile(client, client_for, make_profile):
    other = await make_profile("Luis")
    job = (await client.post("/api/downloads", json={"url": URL})).json()
    other_client = await client_for(other)

    assert (await other_client.get("/api/downloads")).json() == []
    assert (await other_client.get(f"/api/downloads/{job['id']}")).status_code == 404
    assert (await other_client.post(f"/api/downloads/{job['id']}/cancel")).status_code == 404
    assert (await other_client.post("/api/downloads", json={"url": URL})).status_code == 201


async def test_worker_downloads_with_the_cookies_of_the_profile(client, profile, media_root):
    profile_dir(profile.id).mkdir(parents=True, exist_ok=True)
    (profile_dir(profile.id) / "cookies.txt").write_text("# Netscape HTTP Cookie File\n")
    await client.post("/api/downloads", json={"url": URL})
    downloader = FakeDownloader(media_root)

    await DownloadWorker(downloader).run_once()

    assert downloader.cookies_file == cookies_path(profile.id)
    assert (await client.get("/api/videos")).json()["total"] == 1


async def test_subscriptions_are_kept_per_profile(
    client, client_for, make_profile, youtube, channel_service
):
    other = await make_profile("Luis")
    other_client = await client_for(other)

    await client.get("/api/channels")
    await channel_service.wait()
    youtube.subs = youtube.subs[1:]
    await other_client.get("/api/channels")
    await channel_service.wait()

    mine = (await client.get("/api/channels")).json()["items"]
    theirs = (await other_client.get("/api/channels")).json()["items"]
    assert [c["name"] for c in mine] == ["Alpha", "beta"]
    assert [c["name"] for c in theirs] == ["beta"]
    assert youtube.calls == ["subscriptions", "subscriptions"]


async def test_first_profile_claims_the_videos_and_downloads_from_before(
    client, profile, make_video
):
    await make_video("old", owners=[])
    async with SessionLocal() as session:
        session.add(DownloadJob(url=URL))
        await session.commit()
        await claim_orphans(session, profile.id)
        await session.commit()

    assert (await client.get("/api/videos")).json()["total"] == 1
    assert len((await client.get("/api/downloads")).json()) == 1
