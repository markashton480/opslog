import asyncio
import json
import logging
from dataclasses import dataclass, field
from time import monotonic
from typing import Any

import httpx
import jwt

from app.config import settings

logger = logging.getLogger(__name__)


class OIDCVerificationError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


@dataclass
class OIDCVerificationResult:
    claims: dict[str, Any]
    warnings: list[str] = field(default_factory=list)


class OIDCVerifier:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._jwks_uri: str | None = None
        self._jwks_cache: dict[str, Any] | None = None
        self._jwks_expires_at: float = 0.0

    async def verify(self, token: str) -> OIDCVerificationResult:
        issuer = settings.oidc_issuer
        audience = settings.oidc_audience
        if not issuer or not audience:
            raise OIDCVerificationError("oidc_misconfigured")

        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError as exc:
            raise OIDCVerificationError("invalid_jwt_header") from exc

        alg = header.get("alg")
        if not isinstance(alg, str) or alg != "RS256":
            raise OIDCVerificationError("invalid_jwt_alg")

        kid = header.get("kid")
        jwks, warnings = await self._get_jwks()
        key = self._resolve_key(jwks, kid)

        try:
            claims = jwt.decode(
                token,
                key=key,
                algorithms=["RS256"],
                audience=audience,
                issuer=issuer,
                options={"verify_signature": True, "verify_exp": True, "verify_nbf": True},
            )
        except jwt.PyJWTError as exc:
            raise OIDCVerificationError("invalid_jwt_claims") from exc

        return OIDCVerificationResult(claims=claims, warnings=warnings)

    async def _get_jwks(self) -> tuple[dict[str, Any], list[str]]:
        now = monotonic()
        cached = self._jwks_cache
        if cached is not None and now < self._jwks_expires_at:
            return cached, []

        async with self._lock:
            now = monotonic()
            cached = self._jwks_cache
            if cached is not None and now < self._jwks_expires_at:
                return cached, []

            try:
                refreshed = await self._refresh_jwks()
                self._jwks_cache = refreshed
                self._jwks_expires_at = monotonic() + max(30, settings.oidc_jwks_ttl_seconds)
                return refreshed, []
            except OIDCVerificationError:
                if cached is not None:
                    logger.warning("OIDC JWKS refresh failed; using stale cache", exc_info=True)
                    return cached, ["oidc-jwks-stale-cache"]
                raise

    async def _refresh_jwks(self) -> dict[str, Any]:
        jwks_uri = await self._get_jwks_uri()
        payload = await self._fetch_json(jwks_uri)
        keys = payload.get("keys")
        if not isinstance(keys, list):
            raise OIDCVerificationError("invalid_jwks")
        return payload

    async def _get_jwks_uri(self) -> str:
        if settings.oidc_jwks_url:
            return settings.oidc_jwks_url

        if self._jwks_uri:
            return self._jwks_uri

        issuer = settings.oidc_issuer
        if not issuer:
            raise OIDCVerificationError("oidc_misconfigured")

        discovery_url = issuer.rstrip("/") + "/.well-known/openid-configuration"
        payload = await self._fetch_json(discovery_url)
        jwks_uri = payload.get("jwks_uri")
        if not isinstance(jwks_uri, str) or not jwks_uri:
            raise OIDCVerificationError("oidc_missing_jwks_uri")
        self._jwks_uri = jwks_uri
        return jwks_uri

    async def _fetch_json(self, url: str) -> dict[str, Any]:
        timeout = settings.oidc_http_timeout_seconds
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(url)
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise OIDCVerificationError("oidc_http_error") from exc

        if not isinstance(payload, dict):
            raise OIDCVerificationError("oidc_invalid_json")
        return payload

    @staticmethod
    def _resolve_key(jwks: dict[str, Any], kid: str | None):
        keys = jwks.get("keys")
        if not isinstance(keys, list):
            raise OIDCVerificationError("invalid_jwks")

        selected_key: dict[str, Any] | None = None
        if kid is not None:
            for item in keys:
                if isinstance(item, dict) and item.get("kid") == kid:
                    selected_key = item
                    break

        if selected_key is None and len(keys) == 1 and isinstance(keys[0], dict):
            selected_key = keys[0]

        if selected_key is None:
            raise OIDCVerificationError("oidc_kid_not_found")

        try:
            return jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(selected_key))
        except (TypeError, ValueError) as exc:
            raise OIDCVerificationError("invalid_jwk") from exc

    def reset_cache_for_tests(self) -> None:
        self._jwks_uri = None
        self._jwks_cache = None
        self._jwks_expires_at = 0.0


_verifier = OIDCVerifier()


async def verify_oidc_token(token: str) -> OIDCVerificationResult:
    return await _verifier.verify(token)


def reset_oidc_cache_for_tests() -> None:
    _verifier.reset_cache_for_tests()
