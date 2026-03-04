import asyncio
import hashlib
import logging
from typing import Any

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config import settings
from app.db import get_pool
from app.enums import Role
from app.oidc import OIDCVerificationError, verify_oidc_token

logger = logging.getLogger(__name__)

EXEMPT_PATHS = {
    "/api/v1/health",
    "/api/v1/categories",
    "/docs",
    "/openapi.json",
    "/redoc",
}


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def _touch_last_seen(principal: str) -> None:
    pool = get_pool()
    await pool.execute(
        "UPDATE principals SET last_seen_at = NOW() WHERE name = $1",
        principal,
    )


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.warnings = []
        request.state.principal = None
        request.state.role = None
        request.state.auth_source = None

        if request.url.path in EXEMPT_PATHS:
            return await call_next(request)

        auth_header = request.headers.get("authorization")
        if not auth_header:
            return JSONResponse(
                status_code=401,
                content={"data": {"error": "missing_authorization"}, "warnings": []},
            )

        parts = auth_header.split(" ", maxsplit=1)
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return JSONResponse(
                status_code=401,
                content={"data": {"error": "invalid_authorization_scheme"}, "warnings": []},
            )

        token = parts[1].strip()
        principal_row = await _resolve_principal(token, request)

        if principal_row is None:
            return JSONResponse(
                status_code=401,
                content={"data": {"error": "invalid_token"}, "warnings": []},
            )

        request.state.principal = principal_row["name"]
        request.state.role = principal_row["role"]

        # Non-blocking best-effort update.
        asyncio.create_task(_touch_last_seen(principal_row["name"]))

        return await call_next(request)


def require_roles(*roles: Role):
    allowed = {role.value for role in roles}

    async def dependency(request: Request) -> None:
        if request.state.role not in allowed:
            raise HTTPException(status_code=403, detail="insufficient_role")

    return dependency


async def _resolve_principal(token: str, request: Request) -> Any | None:
    if _looks_like_jwt(token):
        if not settings.oidc_enabled:
            return None
        return await _resolve_oidc_principal(token, request)
    return await _resolve_legacy_principal(token, request)


def _looks_like_jwt(token: str) -> bool:
    # Legacy API tokens are generated as `opslog_<name>_<hex>` and never contain dots.
    # JWTs always have three segments separated by dots.
    return token.count(".") == 2


async def _resolve_legacy_principal(token: str, request: Request) -> Any | None:
    token_hash = hash_token(token)
    pool = get_pool()
    principal_row = await pool.fetchrow(
        """
        SELECT name, role
        FROM principals
        WHERE token_hash = $1
          AND status = 'active'
        """,
        token_hash,
    )
    if principal_row is not None:
        request.state.auth_source = "token"
    return principal_row


async def _resolve_oidc_principal(token: str, request: Request) -> Any | None:
    try:
        verification = await verify_oidc_token(token)
    except OIDCVerificationError as exc:
        logger.warning("OIDC token verification failed: %s", exc.code)
        return None

    username_claim = settings.oidc_username_claim
    principal_name = verification.claims.get(username_claim)
    if not isinstance(principal_name, str) or not principal_name:
        return None

    pool = get_pool()
    principal_row = await pool.fetchrow(
        """
        SELECT name, role
        FROM principals
        WHERE name = $1
          AND status = 'active'
        """,
        principal_name,
    )
    if principal_row is not None:
        request.state.auth_source = "oidc"
        request.state.warnings.extend(verification.warnings)
    return principal_row
