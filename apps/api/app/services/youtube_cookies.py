import json
import logging
import os
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from http.cookiejar import MozillaCookieJar

import httpx

from app.models import Profile
from app.services.connectivity import connectivity
from app.services.image_cache import ImageFetcher, cache_image, http_fetch
from app.services.profiles import profile_dir
from app.services.youtube import sized_image

logger = logging.getLogger(__name__)

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
    name: str | None
    avatar_url: str | None


AccountReader = Callable[[str], Awaitable[Account | None]]


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
                        name=item.get("accountName", {}).get("simpleText"),
                        avatar_url=photos[-1].get("url"),
                    )
    return None


async def read_account(cookies_file: str) -> Account | None:
    """Ask YouTube, with the profile's cookies, which account is signed in."""
    jar = MozillaCookieJar(cookies_file)
    jar.load(ignore_discard=True, ignore_expires=True)
    async with httpx.AsyncClient(
        cookies=jar, headers={"User-Agent": USER_AGENT}, timeout=15, follow_redirects=True
    ) as client:
        try:
            response = await client.get("https://www.youtube.com/getAccountSwitcherEndpoint")
            response.raise_for_status()
            account = _selected_account(json.loads(response.text.removeprefix(")]}'")))
            if account:
                return account
        except (httpx.HTTPError, ValueError, LookupError, TypeError) as exc:
            logger.info("the account switcher did not answer: %s", exc)
        try:
            response = await client.get("https://www.youtube.com/")
            match = TOPBAR_AVATAR.search(response.text)
            return Account(name=None, avatar_url=match.group(1)) if match else None
        except httpx.HTTPError as exc:
            logger.info("could not open youtube.com: %s", exc)
            return None


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

    def validate(self, text: str) -> str:
        return normalize(text)

    async def apply(self, profile: Profile, text: str) -> None:
        directory = profile_dir(profile.id)
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / "cookies.txt"
        temporary = path.with_suffix(".tmp")
        temporary.write_text(text)
        os.chmod(temporary, 0o600)
        temporary.replace(path)
        profile.signed_in_at = datetime.now(UTC)

        if not connectivity.online:
            return
        try:
            account = await self.read(str(path))
        except Exception:
            logger.exception("could not read the YouTube account of %s", profile.id)
            account = None
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
