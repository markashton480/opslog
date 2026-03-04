import pytest

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
