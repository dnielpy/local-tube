import asyncio
import json
import logging
import os
import re
import tempfile
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from http.cookiejar import MozillaCookieJar
from pathlib import Path

import httpx

from app.db import SessionLocal
from app.models import Profile
from app.services.connectivity import connectivity
from app.services.image_cache import ImageFetcher, cache_image, http_fetch
from app.services.profiles import cookies_path, profile_dir
from app.services.youtube import sized_image

logger = logging.getLogger(__name__)

CHECK_INTERVAL = timedelta(minutes=30)

HEADER = "# Netscape HTTP Cookie File"
HTTP_ONLY = "#HttpOnly_"
# YouTube only sends these to a signed-in browser.
SESSION_COOKIES = {"SAPISID", "__Secure-3PAPISID"}
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
)
TOPBAR_AVATAR = re.compile(
    r'"topbarMenuButtonRenderer":\{"avatar":\{"thumbnails":\[\{"url":"([^"]+)"'
)


@dataclass
class Account:
    logged_in: bool
    name: str | None = None
    avatar_url: str | None = None


AccountReader = Callable[[str], Awaitable[Account | None]]

INVALID_SESSION = (
    "YouTube no reconoce estas cookies: la sesión caducó o Google las cambió. Expórtalas de "
    "nuevo desde una ventana privada y ciérrala sin cerrar sesión."
)


def _selected_account(data: dict) -> Account | None:
    sections = data["data"]["actions"][0]["getMultiPageMenuAction"]["menu"][
        "multiPageMenuRenderer"
    ]["sections"]
    for section in sections:
        for group in section.get("accountSectionListRenderer", {}).get("contents", []):
            for entry in group.get("accountItemSectionRenderer", {}).get("contents", []):
                item = entry.get("accountItem")
                if item and item.get("isSelected"):
                    photos = item.get("accountPhoto", {}).get("thumbnails") or [{}]
                    return Account(
                        logged_in=True,
                        name=item.get("accountName", {}).get("simpleText"),
                        avatar_url=photos[-1].get("url"),
                    )
    return None


async def read_account(cookies_file: str) -> Account | None:
    """Ask YouTube, with these cookies, whether they are signed in and as whom.

    None means YouTube could not be asked, so nothing is known about the session. Google
    rotates some session cookies on every answer and may end the session when the old ones keep
    being used, so the renewed cookies are written back to the file, as yt-dlp does.
    """
    jar = MozillaCookieJar(cookies_file)
    jar.load(ignore_discard=True, ignore_expires=True)
    try:
        return await _ask_youtube(jar)
    finally:
        jar.save(ignore_discard=True, ignore_expires=True)


async def _ask_youtube(jar: MozillaCookieJar) -> Account | None:
    async with httpx.AsyncClient(
        cookies=jar, headers={"User-Agent": USER_AGENT}, timeout=15, follow_redirects=True
    ) as client:
        try:
            home = await client.get("https://www.youtube.com/")
            home.raise_for_status()
        except httpx.HTTPError as exc:
            logger.info("could not open youtube.com: %s", exc)
            return None
        if '"LOGGED_IN":true' not in home.text:
            return Account(logged_in=False)
        try:
            response = await client.get("https://www.youtube.com/getAccountSwitcherEndpoint")
            response.raise_for_status()
            account = _selected_account(json.loads(response.text.removeprefix(")]}'")))
            if account:
                return account
        except (httpx.HTTPError, ValueError, LookupError, TypeError) as exc:
            logger.info("the account switcher did not answer: %s", exc)
        match = TOPBAR_AVATAR.search(home.text)
        return Account(logged_in=True, avatar_url=match.group(1) if match else None)


def normalize(text: str) -> str:
    """Check that a pasted cookies.txt holds a YouTube session and clean it up for yt-dlp."""
    lines = []
    names = set()
    for raw in text.replace("\r\n", "\n").split("\n"):
        line = raw.strip("\r")
        if line.startswith(HTTP_ONLY):
            line = line[len(HTTP_ONLY) :]
        if not line.strip() or line.startswith("#"):
            continue
        fields = line.split("\t")
        if len(fields) != 7:
            continue
        lines.append(line)
        if fields[0].lstrip(".").endswith("youtube.com"):
            names.add(fields[5])
    if not lines:
        raise ValueError("No parece un cookies.txt: pega el archivo completo en formato Netscape.")
    if not names & SESSION_COOKIES:
        raise ValueError(
            "Estas cookies no tienen una sesión de YouTube iniciada. Expórtalas desde "
            "youtube.com con tu cuenta abierta."
        )
    return "\n".join([HEADER, *lines]) + "\n"


class YouTubeCookies:
    """Keeps each profile's YouTube cookies, and its account photo and name."""

    def __init__(
        self, read: AccountReader = read_account, fetch: ImageFetcher = http_fetch
    ) -> None:
        self.read = read
        self.fetch = fetch
        self._locks: dict[uuid.UUID, asyncio.Lock] = {}

    async def status(self, profile_id: uuid.UUID) -> Profile:
        """The profile with its cookie status, asking YouTube again when the last check is old."""
        async with self._locks.setdefault(profile_id, asyncio.Lock()):
            async with SessionLocal() as session:
                profile = await session.get_one(Profile, profile_id)
                checked = profile.cookies_checked_at
                path = cookies_path(profile_id)
                if (
                    not connectivity.online
                    or path is None
                    or (checked is not None and datetime.now(UTC) - checked < CHECK_INTERVAL)
                ):
                    return profile
                try:
                    account = await self.read(path)
                except Exception:
                    logger.exception("could not check the cookies of %s", profile_id)
                    account = None
                if account is not None:
                    profile.cookies_valid = account.logged_in
                    profile.cookies_checked_at = datetime.now(UTC)
                    await session.commit()
                return profile

    async def check(self, text: str) -> tuple[str, Account | None]:
        """Clean up pasted cookies and, when online, make sure YouTube accepts them."""
        text = normalize(text)
        if not connectivity.online:
            return text, None
        handle, name = tempfile.mkstemp(suffix=".txt")
        try:
            with os.fdopen(handle, "w") as file:
                file.write(text)
            account = await self.read(name)
            # Keep the cookies YouTube renewed while answering, not the pasted ones.
            if account is not None and account.logged_in:
                text = normalize(await asyncio.to_thread(Path(name).read_text))
        except Exception:
            logger.exception("could not check the YouTube session")
            account = None
        finally:
            os.unlink(name)
        if account is not None and not account.logged_in:
            raise ValueError(INVALID_SESSION)
        return text, account

    async def apply(self, profile: Profile, text: str, account: Account | None) -> None:
        directory = profile_dir(profile.id)
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / "cookies.txt"
        temporary = path.with_suffix(".tmp")
        temporary.write_text(text)
        os.chmod(temporary, 0o600)
        temporary.replace(path)
        profile.signed_in_at = datetime.now(UTC)
        profile.cookies_valid = account.logged_in if account else None
        profile.cookies_checked_at = profile.signed_in_at if account else None
        if account is None:
            return
        profile.youtube_name = account.name or profile.youtube_name
        profile.avatar_path = await cache_image(
            sized_image(account.avatar_url, "s176"),
            "profiles",
            str(profile.id),
            self.fetch,
            profile.avatar_path,
        )


def needs_sign_in(error: str) -> bool:
    """yt-dlp errors that mean YouTube no longer accepts the cookies."""
    return "Sign in to confirm" in error or "cookies are no longer valid" in error


async def mark_expired(profile_id: uuid.UUID) -> None:
    async with SessionLocal() as session, session.begin():
        profile = await session.get(Profile, profile_id)
        if profile is not None:
            profile.cookies_valid = False
            profile.cookies_checked_at = datetime.now(UTC)


async def recheck_soon(profile_id: uuid.UUID) -> None:
    """Forget the last check, so the next status request asks YouTube again."""
    async with SessionLocal() as session, session.begin():
        profile = await session.get(Profile, profile_id)
        if profile is not None:
            profile.cookies_checked_at = None
