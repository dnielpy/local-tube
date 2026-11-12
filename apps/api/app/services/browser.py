import uuid
from dataclasses import dataclass
from typing import Protocol

import httpx


class BrowserError(Exception):
    pass


@dataclass
class BrowserSession:
    profile_id: uuid.UUID | None
    running: bool
    signed_in: bool = False
    cookies: str | None = None
    name: str | None = None
    avatar_url: str | None = None


class Browser(Protocol):
    async def start(self, profile_id: uuid.UUID) -> None: ...

    async def session(self) -> BrowserSession: ...

    async def stop(self) -> None: ...


class HttpBrowser:
    """Talks to the control api of the browser container."""

    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    async def _request(self, method: str, json: dict | None = None) -> httpx.Response:
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=45) as client:
                response = await client.request(method, "/session", json=json)
                response.raise_for_status()
                return response
        except httpx.HTTPError as exc:
            raise BrowserError(f"The browser is not available: {exc}") from exc

    async def start(self, profile_id: uuid.UUID) -> None:
        await self._request("POST", {"profile_id": str(profile_id)})

    async def session(self) -> BrowserSession:
        body = (await self._request("GET")).json()
        profile_id = body.get("profile_id")
        return BrowserSession(
            profile_id=uuid.UUID(profile_id) if profile_id else None,
            running=body.get("running", False),
            signed_in=body.get("signed_in", False),
            cookies=body.get("cookies"),
            name=body.get("name"),
            avatar_url=body.get("avatar_url"),
        )

    async def stop(self) -> None:
        await self._request("DELETE")
