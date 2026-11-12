from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.routers import downloads, health, status, videos
from app.services.connectivity import connectivity, youtube_probe
from app.services.downloader import YtDlpDownloader
from app.services.worker import DownloadWorker


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    settings.media_root.mkdir(parents=True, exist_ok=True)
    if settings.connectivity_check:
        await connectivity.start(
            youtube_probe(settings.connectivity_url), settings.connectivity_interval
        )
    else:
        await connectivity.load()
    worker = None
    if settings.worker_enabled:
        downloader = YtDlpDownloader(
            settings.media_root, settings.cookies_file, settings.cookies_from_browser
        )
        worker = DownloadWorker(downloader, settings.download_concurrency)
        await worker.start()
    app.state.worker = worker
    yield
    if worker is not None:
        await worker.stop()
    await connectivity.stop()


app = FastAPI(title="LocalTube API", lifespan=lifespan)
app.include_router(health.router, prefix="/api")
app.include_router(videos.router, prefix="/api")
app.include_router(downloads.router, prefix="/api")
app.include_router(status.router, prefix="/api")
