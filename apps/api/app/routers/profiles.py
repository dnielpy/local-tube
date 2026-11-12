import shutil
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select

from app.db import SessionDep
from app.media import media_path
from app.models import Profile
from app.routers.channels import ServiceDep
from app.schemas import CookiesIn, PinIn, ProfileCreate, ProfileOut
from app.services.image_cache import remove_cached
from app.services.library import claim_orphans
from app.services.profiles import (
    OptionalProfileDep,
    ProfileDep,
    end_session,
    hash_pin,
    pin_guard,
    profile_dir,
    start_session,
    verify_pin,
)
from app.services.youtube_cookies import YouTubeCookies

router = APIRouter(tags=["profiles"])


def get_youtube_cookies(request: Request) -> YouTubeCookies:
    return request.app.state.youtube_cookies


CookiesDep = Annotated[YouTubeCookies, Depends(get_youtube_cookies)]


async def _get_profile(session: SessionDep, profile_id: uuid.UUID) -> Profile:
    profile = await session.get(Profile, profile_id)
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    return profile


def _locked(profile: Profile) -> HTTPException:
    return HTTPException(
        status.HTTP_429_TOO_MANY_REQUESTS,
        {"message": "Demasiados intentos", "retry_after": pin_guard.retry_after(profile.id)},
    )


def _check_pin(profile: Profile, pin: str) -> None:
    if pin_guard.retry_after(profile.id):
        raise _locked(profile)
    if not verify_pin(pin, profile.pin_hash):
        remaining = pin_guard.failed(profile.id)
        if remaining == 0:
            raise _locked(profile)
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, {"message": "PIN incorrecto", "remaining": remaining}
        )
    pin_guard.succeeded(profile.id)


def _valid_cookies(cookies: YouTubeCookies, text: str) -> str:
    try:
        return cookies.validate(text)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, {"message": str(exc)}) from exc


@router.get("/profiles", response_model=list[ProfileOut])
async def list_profiles(session: SessionDep) -> list[Profile]:
    return list(await session.scalars(select(Profile).order_by(Profile.created_at)))


@router.post("/profiles", response_model=ProfileOut, status_code=status.HTTP_201_CREATED)
async def create_profile(
    body: ProfileCreate,
    session: SessionDep,
    cookies: CookiesDep,
    channels: ServiceDep,
    response: Response,
) -> Profile:
    text = _valid_cookies(cookies, body.cookies)
    first = not await session.scalar(select(func.count()).select_from(Profile))
    profile = Profile(name=body.name, pin_hash=hash_pin(body.pin))
    session.add(profile)
    await session.flush()
    if first:
        await claim_orphans(session, profile.id)
    await cookies.apply(profile, text)
    await session.commit()
    await start_session(response, profile.id)
    await channels.schedule_subscriptions(profile.id, force=True)
    return profile


@router.put("/profiles/{profile_id}/cookies", response_model=ProfileOut)
async def update_cookies(
    profile_id: uuid.UUID,
    body: CookiesIn,
    session: SessionDep,
    current: ProfileDep,
    cookies: CookiesDep,
    channels: ServiceDep,
) -> Profile:
    if current.id != profile_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your profile")
    text = _valid_cookies(cookies, body.cookies)
    profile = await _get_profile(session, profile_id)
    await cookies.apply(profile, text)
    await session.commit()
    await channels.schedule_subscriptions(profile.id, force=True)
    return profile


@router.post("/profiles/{profile_id}/unlock", response_model=ProfileOut)
async def unlock_profile(
    profile_id: uuid.UUID, body: PinIn, session: SessionDep, response: Response
) -> Profile:
    profile = await _get_profile(session, profile_id)
    _check_pin(profile, body.pin)
    await start_session(response, profile.id)
    return profile


@router.delete("/profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    profile_id: uuid.UUID,
    body: PinIn,
    session: SessionDep,
    current: OptionalProfileDep,
    response: Response,
) -> None:
    profile = await _get_profile(session, profile_id)
    _check_pin(profile, body.pin)
    await session.delete(profile)
    await session.commit()
    remove_cached(profile.avatar_path)
    shutil.rmtree(profile_dir(profile.id), ignore_errors=True)
    if current is not None and current.id == profile.id:
        end_session(response)


@router.get("/profiles/{profile_id}/avatar")
async def profile_avatar(profile_id: uuid.UUID, session: SessionDep) -> FileResponse:
    profile = await _get_profile(session, profile_id)
    if not profile.avatar_path or not media_path(profile.avatar_path).is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Avatar not cached")
    return FileResponse(
        media_path(profile.avatar_path), headers={"Cache-Control": "public, max-age=604800"}
    )


@router.get("/session", response_model=ProfileOut)
async def get_session(current: ProfileDep) -> Profile:
    return current


@router.delete("/session", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    end_session(response)
