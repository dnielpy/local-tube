import asyncio
from datetime import datetime

import pytest

from app.config import get_settings
from app.services import download_window
from app.services.worker import DownloadWorker
from tests.test_downloads import URL, FakeDownloader, SlowDownloader


def at(hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 11, 15, hour, minute).astimezone()


@pytest.fixture
def window(monkeypatch):
    def set_window(start: str, end: str) -> None:
        monkeypatch.setattr(get_settings(), "download_window_start", start)
        monkeypatch.setattr(get_settings(), "download_window_end", end)

    return set_window


def test_is_open_between_its_hours(window):
    window("01:00", "08:00")

    assert not download_window.is_open(at(0, 59))
    assert download_window.is_open(at(1))
    assert download_window.is_open(at(7, 59))
    assert not download_window.is_open(at(8))
    assert not download_window.is_open(at(14))


def test_a_window_across_midnight(window):
    window("22:00", "06:00")

    assert download_window.is_open(at(23))
    assert download_window.is_open(at(5))
    assert not download_window.is_open(at(12))


def test_the_same_hours_never_close(window):
    window("00:00", "00:00")

    assert download_window.is_open(at(14))
    assert download_window.next_open(at(14)) is None
    assert download_window.seconds_until_close(at(14)) is None


def test_says_when_it_opens_and_closes(window):
    window("01:00", "08:00")

    assert download_window.next_open(at(14)) == at(1).replace(day=16)
    assert download_window.next_open(at(0, 30)) == at(1)
    assert download_window.next_open(at(3)) is None
    assert download_window.seconds_until_close(at(7, 30)) == 30 * 60


async def test_queued_downloads_wait_for_the_window(client, media_root, monkeypatch):
    job = (await client.post("/api/downloads", json={"url": URL})).json()
    monkeypatch.setattr(download_window, "is_open", lambda now=None: False)

    assert await DownloadWorker(FakeDownloader(media_root)).run_once() is False
    status = (await client.get("/api/downloads/" + job["id"])).json()["status"]
    assert status == "queued"

    monkeypatch.setattr(download_window, "is_open", lambda now=None: True)
    assert await DownloadWorker(FakeDownloader(media_root)).run_once() is True


async def test_a_running_download_goes_back_to_the_queue_when_the_window_ends(
    client, media_root, monkeypatch
):
    job = (await client.post("/api/downloads", json={"url": URL})).json()
    monkeypatch.setattr(download_window, "seconds_until_close", lambda now=None: 0.2)

    await asyncio.wait_for(DownloadWorker(SlowDownloader(media_root)).run_once(), 5)

    done = (await client.get(f"/api/downloads/{job['id']}")).json()
    assert done["status"] == "queued"
    assert (media_root / "dQw4w9WgXcQ" / "video.mp4.part").read_bytes() == b"partial"


async def test_status_says_when_downloads_resume(client, window):
    window("00:00", "00:00")
    assert (await client.get("/api/status")).json()["downloads_resume_at"] is None


async def test_downloads_any_hour_opens_the_window_and_persists(client, window):
    window("01:00", "08:00")

    body = (await client.put("/api/status", json={"downloads_any_hour": True})).json()

    assert body["downloads_any_hour"] is True
    assert body["downloads_resume_at"] is None
    assert body["forced_offline"] is False
    assert download_window.is_open(at(14))
    assert download_window.seconds_until_close(at(7, 30)) is None
    download_window.state.any_hour = False
    await download_window.load()
    assert download_window.state.any_hour is True

    await client.put("/api/status", json={"downloads_any_hour": False})
    assert not download_window.is_open(at(14))


async def test_switching_any_hour_off_sends_a_running_download_back_to_the_queue(
    client, media_root, window, monkeypatch
):
    window("01:00", "08:00")
    await client.put("/api/status", json={"downloads_any_hour": True})
    job = (await client.post("/api/downloads", json={"url": URL})).json()
    downloader = SlowDownloader(media_root)
    worker = DownloadWorker(downloader)
    running = asyncio.create_task(worker.run_once())
    await asyncio.to_thread(downloader.started.wait, 5)

    await download_window.set_any_hour(False)
    monkeypatch.setattr(download_window, "is_open", lambda now=None: False)
    worker.close_window()
    await asyncio.wait_for(running, 5)

    assert (await client.get(f"/api/downloads/{job['id']}")).json()["status"] == "queued"
