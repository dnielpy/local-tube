import hashlib
import logging
from collections.abc import Awaitable, Callable

import httpx

from app.media import media_path

logger = logging.getLogger(__name__)

ImageFetcher = Callable[[str], Awaitable[tuple[bytes, str]]]

EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}


async def http_fetch(url: str) -> tuple[bytes, str]:
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        response = await client.get(url)
        response.raise_for_status()
    return response.content, response.headers.get("content-type", "image/jpeg").split(";")[0]


def remove_cached(relative: str | None) -> None:
    if relative:
        media_path(relative).unlink(missing_ok=True)


async def cache_image(
    url: str | None,
    kind: str,
    key: str,
    fetch: ImageFetcher,
    current: str | None = None,
) -> str | None:
    if not url:
        return current
    stem = f".cache/{kind}/{key}-{hashlib.sha1(url.encode()).hexdigest()[:12]}"
    if current and current.startswith(stem) and media_path(current).is_file():
        return current
    existing = next(media_path(stem).parent.glob(media_path(stem).name + ".*"), None)
    if existing is None:
        try:
            content, content_type = await fetch(url)
        except Exception as exc:
            logger.warning("could not cache %s: %s", url, exc)
            return current
        existing = media_path(f"{stem}.{EXTENSIONS.get(content_type, 'jpg')}")
        existing.parent.mkdir(parents=True, exist_ok=True)
        existing.write_bytes(content)
    relative = f"{stem}{existing.suffix}"
    if current and current != relative:
        remove_cached(current)
    return relative
