from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.routers import health, videos


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    get_settings().media_root.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="LocalTube API", lifespan=lifespan)
app.include_router(health.router, prefix="/api")
app.include_router(videos.router, prefix="/api")
