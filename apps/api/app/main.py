import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.routers import channels, downloads, health, profiles, status, videos
from app.services.channels import ChannelService
from app.services.connectivity import connectivity, youtube_probe
from app.services.downloader import YtDlpDownloader
from app.services.image_cache import http_fetch
from app.services.worker import DownloadWorker
from app.services.youtube import YtDlpYouTubeClient


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
    channel_service = ChannelService(
        YtDlpYouTubeClient(settings.cookies_file, settings.cookies_from_browser)
    )
    app.state.channel_service = channel_service
    downloader = YtDlpDownloader(
        settings.media_root, settings.cookies_file, settings.cookies_from_browser
    )
    app.state.downloader = downloader
    worker = None
    backfill = None
    if settings.worker_enabled:
        worker = DownloadWorker(
            downloader,
            settings.download_concurrency,
            on_video_added=channel_service.ensure_channel_media,
            fetch_image=http_fetch,
        )
        await worker.start()
        backfill = asyncio.create_task(
            channel_service.backfill_video_channels(
                lambda url: downloader.probe(url).info.get("channel_id")
            )
        )
    media_sweep = asyncio.create_task(channel_service.keep_channel_media())
    app.state.worker = worker
    yield
    media_sweep.cancel()
    if backfill is not None:
        backfill.cancel()
    if worker is not None:
        await worker.stop()
    await connectivity.stop()


app = FastAPI(title="LocalTube API", lifespan=lifespan)
app.include_router(health.router, prefix="/api")
app.include_router(videos.router, prefix="/api")
app.include_router(downloads.router, prefix="/api")
app.include_router(status.router, prefix="/api")
app.include_router(channels.router, prefix="/api")
app.include_router(profiles.router, prefix="/api")
