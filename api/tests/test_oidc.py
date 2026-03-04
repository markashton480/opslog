import pytest

from app.config import settings
from app.oidc import OIDCVerificationError, OIDCVerifier


@pytest.mark.asyncio
async def test_jwks_refresh_failure_without_cache_fails_closed(monkeypatch):
    verifier = OIDCVerifier()

    async def fail_refresh():
        raise OIDCVerificationError("oidc_http_error")

    monkeypatch.setattr(verifier, "_refresh_jwks", fail_refresh)

    with pytest.raises(OIDCVerificationError):
        await verifier._get_jwks()


@pytest.mark.asyncio
async def test_jwks_refresh_failure_uses_stale_cache(monkeypatch):
    verifier = OIDCVerifier()
    verifier._jwks_cache = {"keys": [{"kid": "cached"}]}
    verifier._jwks_expires_at = 0.0

    async def fail_refresh():
        raise OIDCVerificationError("oidc_http_error")

    monkeypatch.setattr(verifier, "_refresh_jwks", fail_refresh)

    cached, warnings = await verifier._get_jwks()
    assert cached == {"keys": [{"kid": "cached"}]}
    assert warnings == ["oidc-jwks-stale-cache"]


@pytest.mark.asyncio
async def test_verify_uses_configured_algorithms(monkeypatch):
    verifier = OIDCVerifier()
    original_issuer = settings.oidc_issuer
    original_audience = settings.oidc_audience
    original_algorithms = list(settings.oidc_algorithms)
    settings.oidc_issuer = "https://id.example.com/realms/lintel"
    settings.oidc_audience = "opslog-dev"
    settings.oidc_algorithms = ["RS256", "ES256"]

    async def fake_get_jwks():
        return {"keys": [{"kid": "key-1"}]}, []

    monkeypatch.setattr(verifier, "_get_jwks", fake_get_jwks)
    monkeypatch.setattr(verifier, "_resolve_key", lambda _jwks, _kid, _alg: "key")
    monkeypatch.setattr("jwt.get_unverified_header", lambda _: {"alg": "ES256", "kid": "key-1"})

    captured_algorithms: list[str] = []

    def fake_decode(*args, **kwargs):
        del args
        captured_algorithms.extend(kwargs["algorithms"])
        return {"preferred_username": "mark"}

    monkeypatch.setattr("jwt.decode", fake_decode)

    try:
        result = await verifier.verify("token-value")
        assert result.claims["preferred_username"] == "mark"
        assert captured_algorithms == ["RS256", "ES256"]
    finally:
        settings.oidc_issuer = original_issuer
        settings.oidc_audience = original_audience
        settings.oidc_algorithms = original_algorithms
        await verifier.close()


@pytest.mark.asyncio
async def test_verify_rejects_alg_not_in_configuration(monkeypatch):
    verifier = OIDCVerifier()
    original_issuer = settings.oidc_issuer
    original_audience = settings.oidc_audience
    original_algorithms = list(settings.oidc_algorithms)
    settings.oidc_issuer = "https://id.example.com/realms/lintel"
    settings.oidc_audience = "opslog-dev"
    settings.oidc_algorithms = ["RS256"]

    monkeypatch.setattr("jwt.get_unverified_header", lambda _: {"alg": "ES256", "kid": "key-1"})

    try:
        with pytest.raises(OIDCVerificationError, match="invalid_jwt_alg"):
            await verifier.verify("token-value")
    finally:
        settings.oidc_issuer = original_issuer
        settings.oidc_audience = original_audience
        settings.oidc_algorithms = original_algorithms
        await verifier.close()
