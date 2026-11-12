import hashlib
import hmac
import secrets
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Response, status

from app.config import get_settings
from app.db import SessionDep
from app.models import Profile
from app.settings_store import read_setting, write_setting

SESSION_COOKIE = "localtube_session"
SESSION_TTL = 30 * 24 * 3600
SECRET_KEY = "session_secret"
MAX_FAILURES = 5
LOCKOUT_SECONDS = 60

_secret: bytes | None = None


def profile_dir(profile_id: uuid.UUID) -> Path:
    return get_settings().profiles_root / str(profile_id)


def cookies_path(profile_id: uuid.UUID | None) -> str | None:
    """The cookies.txt yt-dlp uses for a profile's downloads and subscriptions."""
    if profile_id is None:
        return None
    path = profile_dir(profile_id) / "cookies.txt"
    return str(path) if path.is_file() else None


def hash_pin(pin: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(pin.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_pin(pin: str, stored: str) -> bool:
    _, salt, digest = stored.split("$")
    candidate = hashlib.scrypt(pin.encode(), salt=bytes.fromhex(salt), n=2**14, r=8, p=1)
    return hmac.compare_digest(candidate.hex(), digest)


async def _session_secret() -> bytes:
    global _secret
    if _secret is None:
        stored = await read_setting(SECRET_KEY)
        if stored is None:
            stored = secrets.token_hex(32)
            await write_setting(SECRET_KEY, stored)
        _secret = bytes.fromhex(stored)
    return _secret


def _sign(secret: bytes, payload: str) -> str:
    return hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()


async def session_token(profile_id: uuid.UUID) -> str:
    payload = f"{profile_id}.{int(time.time()) + SESSION_TTL}"
    return f"{payload}.{_sign(await _session_secret(), payload)}"


async def session_profile_id(token: str | None) -> uuid.UUID | None:
    if not token or token.count(".") != 2:
        return None
    profile_id, expires, signature = token.split(".")
    if not hmac.compare_digest(
        _sign(await _session_secret(), f"{profile_id}.{expires}"), signature
    ):
        return None
    if not expires.isdigit() or int(expires) < time.time():
        return None
    try:
        return uuid.UUID(profile_id)
    except ValueError:
        return None


async def start_session(response: Response, profile_id: uuid.UUID) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        await session_token(profile_id),
        max_age=SESSION_TTL,
        httponly=True,
        samesite="lax",
    )


def end_session(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, httponly=True, samesite="lax")


async def _session_profile(session: SessionDep, token: str | None) -> Profile | None:
    profile_id = await session_profile_id(token)
    return await session.get(Profile, profile_id) if profile_id else None


async def optional_profile(
    session: SessionDep, localtube_session: Annotated[str | None, Cookie()] = None
) -> Profile | None:
    return await _session_profile(session, localtube_session)


async def current_profile(
    session: SessionDep, localtube_session: Annotated[str | None, Cookie()] = None
) -> Profile:
    profile = await _session_profile(session, localtube_session)
    if profile is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Choose a profile")
    return profile


OptionalProfileDep = Annotated[Profile | None, Depends(optional_profile)]
ProfileDep = Annotated[Profile, Depends(current_profile)]


@dataclass
class _Attempts:
    failures: int = 0
    locked_until: float = 0


class PinGuard:
    """Locks a profile for a minute after too many wrong PINs."""

    def __init__(self) -> None:
        self._attempts: dict[uuid.UUID, _Attempts] = {}

    def retry_after(self, profile_id: uuid.UUID) -> int:
        attempts = self._attempts.get(profile_id)
        remaining = attempts.locked_until - time.monotonic() if attempts else 0
        return max(0, int(remaining + 0.999))

    def failed(self, profile_id: uuid.UUID) -> int:
        attempts = self._attempts.setdefault(profile_id, _Attempts())
        attempts.failures += 1
        if attempts.failures >= MAX_FAILURES:
            attempts.failures = 0
            attempts.locked_until = time.monotonic() + LOCKOUT_SECONDS
            return 0
        return MAX_FAILURES - attempts.failures

    def succeeded(self, profile_id: uuid.UUID) -> None:
        self._attempts.pop(profile_id, None)


pin_guard = PinGuard()
