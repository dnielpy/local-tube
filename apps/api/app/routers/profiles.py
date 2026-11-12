import shutil
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.db import SessionDep
from app.media import media_path
from app.models import Profile, ProfileStatus
from app.schemas import LoginOut, PinIn, ProfileCreate, ProfileOut
from app.services.browser import BrowserError
from app.services.connectivity import connectivity
from app.services.image_cache import remove_cached
from app.services.login import LoginService
from app.services.profiles import (
    AnyProfileDep,
    OptionalProfileDep,
    end_session,
    hash_pin,
    pin_guard,
    profile_dir,
    start_session,
    verify_pin,
)

router = APIRouter(tags=["profiles"])


def get_login(request: Request) -> LoginService:
    return request.app.state.login


LoginDep = Annotated[LoginService, Depends(get_login)]


def _browser_unavailable(exc: BrowserError) -> HTTPException:
    return HTTPException(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        {"message": "El navegador para iniciar sesión no está disponible", "error": str(exc)},
    )


async def _get_profile(session: SessionDep, profile_id: uuid.UUID) -> Profile:
    profile = await session.get(Profile, profile_id)
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    return profile


def _check_pin(profile: Profile, pin: str) -> None:
    retry_after = pin_guard.retry_after(profile.id)
    if retry_after:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            {"message": "Demasiados intentos", "retry_after": retry_after},
        )
    if not verify_pin(pin, profile.pin_hash):
        remaining = pin_guard.failed(profile.id)
        if remaining == 0:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                {
                    "message": "Demasiados intentos",
                    "retry_after": pin_guard.retry_after(profile.id),
                },
            )
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, {"message": "PIN incorrecto", "remaining": remaining}
        )
    pin_guard.succeeded(profile.id)


@router.get("/profiles", response_model=list[ProfileOut])
async def list_profiles(session: SessionDep) -> list[Profile]:
    rows = await session.scalars(
        select(Profile).where(Profile.status == ProfileStatus.ready).order_by(Profile.created_at)
    )
    return list(rows)


@router.post("/profiles", response_model=ProfileOut, status_code=status.HTTP_201_CREATED)
async def create_profile(
    body: ProfileCreate, session: SessionDep, login: LoginDep, response: Response
) -> Profile:
    if not connectivity.online:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, {"message": "Sin conexión"})
    profile = Profile(name=body.name, pin_hash=hash_pin(body.pin))
    session.add(profile)
    await session.commit()
    try:
        await login.start(profile.id)
    except BrowserError as exc:
        await session.delete(profile)
        await session.commit()
        raise _browser_unavailable(exc) from exc
    await start_session(response, profile.id)
    return profile


def _own(current: Profile, profile_id: uuid.UUID) -> None:
    if current.id != profile_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your profile")


@router.post("/profiles/{profile_id}/youtube", response_model=LoginOut)
async def start_youtube_login(
    profile_id: uuid.UUID, current: AnyProfileDep, login: LoginDep
) -> LoginOut:
    _own(current, profile_id)
    if not connectivity.online:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, {"message": "Sin conexión"})
    try:
        await login.start(profile_id)
    except BrowserError as exc:
        raise _browser_unavailable(exc) from exc
    return LoginOut(state="waiting")


@router.get("/profiles/{profile_id}/youtube", response_model=LoginOut)
async def youtube_login(
    profile_id: uuid.UUID, current: AnyProfileDep, login: LoginDep, session: SessionDep
) -> LoginOut:
    _own(current, profile_id)
    try:
        state = await login.poll(profile_id)
    except BrowserError as exc:
        raise _browser_unavailable(exc) from exc
    profile = await session.get(Profile, profile_id, populate_existing=True)
    return LoginOut(state=state, profile=ProfileOut.model_validate(profile) if profile else None)


@router.delete("/profiles/{profile_id}/youtube", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_youtube_login(
    profile_id: uuid.UUID, current: AnyProfileDep, login: LoginDep
) -> None:
    _own(current, profile_id)
    await login.cancel(profile_id)


@router.get("/profiles/browser-auth", include_in_schema=False)
async def browser_auth(current: OptionalProfileDep, login: LoginDep) -> Response:
    """Lets Caddy open the browser only to the profile that is signing in."""
    if current is None or login.active != current.id:
        return Response(status_code=status.HTTP_401_UNAUTHORIZED)
    return Response(status_code=status.HTTP_200_OK)


@router.post("/profiles/{profile_id}/unlock", response_model=ProfileOut)
async def unlock_profile(
    profile_id: uuid.UUID, body: PinIn, session: SessionDep, response: Response
) -> Profile:
    profile = await _get_profile(session, profile_id)
    if profile.status != ProfileStatus.ready:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    _check_pin(profile, body.pin)
    await start_session(response, profile.id)
    return profile


@router.delete("/profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    profile_id: uuid.UUID,
    session: SessionDep,
    current: OptionalProfileDep,
    login: LoginDep,
    response: Response,
    body: PinIn | None = None,
) -> None:
    profile = await _get_profile(session, profile_id)
    if profile.status == ProfileStatus.pending:
        if current is None or current.id != profile.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your profile")
    else:
        if body is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "PIN required")
        _check_pin(profile, body.pin)
    await login.cancel(profile.id)
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
async def get_session(current: AnyProfileDep) -> Profile:
    return current


@router.delete("/session", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    end_session(response)
