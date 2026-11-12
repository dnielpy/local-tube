import pytest

from app.db import SessionLocal
from app.models import DownloadJob, JobStatus
from app.services.connectivity import connectivity
from app.services.downloader import (
    DownloadError,
    DownloadResult,
    Probe,
    Progress,
    clean_error,
    format_selector,
)
from app.services.worker import DownloadWorker, format_eta, format_speed, requeue_interrupted_jobs

URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


class FakeDownloader:
    def __init__(self, media_root, fail_with: str | None = None) -> None:
        self.media_root = media_root
        self.fail_with = fail_with
        self.downloads = 0

    def probe(self, url: str) -> Probe:
        if self.fail_with:
            raise DownloadError(self.fail_with)
        return Probe(youtube_id="dQw4w9WgXcQ", title="Never Gonna Give You Up", info={})

    def download(self, probe: Probe, on_progress, max_height=None) -> DownloadResult:
        self.downloads += 1
        self.max_height = max_height
        on_progress(Progress("downloading", percent=50, speed=2 * 1024 * 1024, eta=30))
        directory = self.media_root / probe.youtube_id
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "video.mp4").write_bytes(b"video")
        return DownloadResult(
            youtube_id=probe.youtube_id,
            title="Never Gonna Give You Up",
            description="The official video",
            channel="Rick Astley",
            channel_id="UCuAXFkgsw1L7xaCfnd5JJOw",
            duration_seconds=213,
            youtube_url=URL,
            file_path=f"{probe.youtube_id}/video.mp4",
            thumbnail_path=None,
            file_size=5,
        )


async def test_create_download_queues_job(client):
    response = await client.post("/api/downloads", json={"url": URL})

    assert response.status_code == 201
    assert response.json()["status"] == "queued"
    assert len((await client.get("/api/downloads")).json()) == 1


async def test_create_download_defaults_to_360p(client):
    default = (await client.post("/api/downloads", json={"url": URL})).json()
    best = (
        await client.post("/api/downloads", json={"url": URL + "&x=1", "max_height": None})
    ).json()

    assert default["max_height"] == 360
    assert best["max_height"] is None


async def test_create_download_rejects_unknown_quality(client):
    response = await client.post("/api/downloads", json={"url": URL, "max_height": 361})
    assert response.status_code == 422


async def test_create_download_rejects_non_urls(client):
    response = await client.post("/api/downloads", json={"url": "not a url"})
    assert response.status_code == 422


async def test_create_download_rejects_video_already_in_library(client, make_video):
    video = await make_video("dQw4w9WgXcQ")

    response = await client.post(
        "/api/downloads", json={"url": f"https://youtu.be/{video.youtube_id}"}
    )

    assert response.status_code == 409
    assert response.json()["detail"]["video_id"] == str(video.id)


async def test_create_download_rejects_duplicate_active_job(client):
    await client.post("/api/downloads", json={"url": URL})

    response = await client.post("/api/downloads", json={"url": URL})

    assert response.status_code == 409


async def test_worker_downloads_and_creates_video(client, media_root):
    job = (await client.post("/api/downloads", json={"url": URL, "max_height": 720})).json()
    downloader = FakeDownloader(media_root)
    worker = DownloadWorker(downloader)

    assert await worker.run_once() is True
    assert downloader.max_height == 720
    assert await worker.run_once() is False

    done = (await client.get(f"/api/downloads/{job['id']}")).json()
    assert done["status"] == "completed"
    assert done["progress"] == 100
    assert done["title"] == "Never Gonna Give You Up"
    video = (await client.get(f"/api/videos/{done['video_id']}")).json()
    assert video["channel"] == "Rick Astley"
    assert video["duration_seconds"] == 213


async def test_worker_links_existing_video_without_downloading(client, make_video, media_root):
    async with SessionLocal() as session:
        job = DownloadJob(url="https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=abc")
        session.add(job)
        await session.commit()
    video = await make_video("dQw4w9WgXcQ")
    downloader = FakeDownloader(media_root)

    await DownloadWorker(downloader).run_once()

    done = (await client.get(f"/api/downloads/{job.id}")).json()
    assert done["status"] == "completed"
    assert done["video_id"] == str(video.id)
    assert downloader.downloads == 0


async def test_failed_download_can_be_retried(client, media_root):
    job = (await client.post("/api/downloads", json={"url": URL})).json()

    await DownloadWorker(FakeDownloader(media_root, fail_with="Video unavailable")).run_once()
    failed = (await client.get(f"/api/downloads/{job['id']}")).json()
    retried = await client.post(f"/api/downloads/{job['id']}/retry")
    await DownloadWorker(FakeDownloader(media_root)).run_once()

    assert failed["status"] == "failed"
    assert failed["error"] == "Video unavailable"
    assert retried.json()["status"] == "queued"
    assert (await client.get(f"/api/downloads/{job['id']}")).json()["status"] == "completed"


async def test_retry_only_failed_jobs(client):
    job = (await client.post("/api/downloads", json={"url": URL})).json()
    assert (await client.post(f"/api/downloads/{job['id']}/retry")).status_code == 409


async def test_delete_download(client):
    job = (await client.post("/api/downloads", json={"url": URL})).json()

    assert (await client.delete(f"/api/downloads/{job['id']}")).status_code == 204
    assert (await client.get("/api/downloads")).json() == []


async def test_interrupted_jobs_are_requeued(client):
    async with SessionLocal() as session:
        job = DownloadJob(url=URL, status=JobStatus.downloading, progress=40)
        session.add(job)
        await session.commit()

    await requeue_interrupted_jobs()

    requeued = (await client.get(f"/api/downloads/{job.id}")).json()
    assert requeued["status"] == "queued"
    assert requeued["progress"] == 0


@pytest.mark.parametrize(
    ("speed", "expected"),
    [(None, None), (512, "512.0 B/s"), (2 * 1024 * 1024, "2.0 MiB/s")],
)
def test_format_speed(speed, expected):
    assert format_speed(speed) == expected


@pytest.mark.parametrize(("eta", "expected"), [(None, None), (65, "1:05"), (3725, "1:02:05")])
def test_format_eta(eta, expected):
    assert format_eta(eta) == expected


def test_format_selector_caps_height():
    assert format_selector(360).startswith("bv*[height<=360][ext=mp4][vcodec^=avc]")
    assert format_selector(None).startswith("bv*[ext=mp4]")


def testclean_error_strips_colors():
    error = Exception("\x1b[0;31mERROR:\x1b[0m [youtube] abc: Sign in to confirm")
    assert clean_error(error) == "[youtube] abc: Sign in to confirm"


async def test_worker_waits_while_offline(client, media_root):
    job = (await client.post("/api/downloads", json={"url": URL})).json()
    downloader = FakeDownloader(media_root)
    worker = DownloadWorker(downloader)
    connectivity.forced_offline = True

    assert await worker.run_once() is False
    assert (await client.get(f"/api/downloads/{job['id']}")).json()["status"] == "queued"

    connectivity.forced_offline = False
    assert await worker.run_once() is True
    assert (await client.get(f"/api/downloads/{job['id']}")).json()["status"] == "completed"


async def test_worker_caches_the_channel_before_completing(client, media_root):
    job = (await client.post("/api/downloads", json={"url": URL})).json()
    seen: list[tuple[str | None, str]] = []

    async def on_video_added(channel_id: str | None) -> None:
        status = (await client.get(f"/api/downloads/{job['id']}")).json()["status"]
        seen.append((channel_id, status))

    await DownloadWorker(FakeDownloader(media_root), on_video_added=on_video_added).run_once()

    assert seen == [("UCuAXFkgsw1L7xaCfnd5JJOw", "downloading")]
    assert (await client.get(f"/api/downloads/{job['id']}")).json()["status"] == "completed"
