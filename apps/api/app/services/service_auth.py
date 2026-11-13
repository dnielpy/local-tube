import hmac
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from app.config import get_settings


def require_service_token(x_service_token: Annotated[str | None, Header()] = None) -> None:
    """Other apps on the server reach the stats with the shared SERVICE_TOKEN instead of a
    profile session."""
    expected = get_settings().service_token
    if not expected or not x_service_token or not hmac.compare_digest(x_service_token, expected):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid service token")


ServiceDep = Depends(require_service_token)
