from collections.abc import Iterator

import pytest

from app.config import settings
from app.oidc import OIDCVerificationResult


@pytest.fixture
def oidc_settings_override() -> Iterator[None]:
    original_enabled = settings.oidc_enabled
    original_claim = settings.oidc_username_claim
    settings.oidc_enabled = True
    settings.oidc_username_claim = "preferred_username"
    try:
        yield
    finally:
        settings.oidc_enabled = original_enabled
        settings.oidc_username_claim = original_claim


@pytest.mark.asyncio
async def test_jwt_rejected_when_oidc_disabled(client, monkeypatch):
    original_enabled = settings.oidc_enabled
    settings.oidc_enabled = False
    called = False

    async def fake_verify(_: str):
        nonlocal called
        called = True
        return OIDCVerificationResult(claims={"preferred_username": "mark"})

    monkeypatch.setattr("app.auth.verify_oidc_token", fake_verify)
    try:
        response = await client.get("/api/v1/events", headers={"Authorization": "Bearer part1.part2.part3"})

        assert response.status_code == 401
        assert response.json()["data"]["error"] == "invalid_token"
        assert called is False
    finally:
        settings.oidc_enabled = original_enabled


@pytest.mark.asyncio
async def test_oidc_jwt_maps_to_principal(client, monkeypatch, oidc_settings_override):
    async def fake_verify(_: str):
        return OIDCVerificationResult(
            claims={"preferred_username": "mark"},
            warnings=["oidc-jwks-stale-cache"],
        )

    monkeypatch.setattr("app.auth.verify_oidc_token", fake_verify)

    response = await client.get("/api/v1/events", headers={"Authorization": "Bearer part1.part2.part3"})
    assert response.status_code == 200
    payload = response.json()
    assert "oidc-jwks-stale-cache" in payload["warnings"]


@pytest.mark.asyncio
async def test_oidc_jwt_unknown_principal_is_rejected(client, monkeypatch, oidc_settings_override):
    async def fake_verify(_: str):
        return OIDCVerificationResult(claims={"preferred_username": "does-not-exist"})

    monkeypatch.setattr("app.auth.verify_oidc_token", fake_verify)

    response = await client.get("/api/v1/events", headers={"Authorization": "Bearer part1.part2.part3"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_oidc_jwt_revoked_principal_is_rejected(client, monkeypatch, oidc_settings_override):
    async def fake_verify(_: str):
        return OIDCVerificationResult(claims={"preferred_username": "revoked_user"})

    monkeypatch.setattr("app.auth.verify_oidc_token", fake_verify)

    response = await client.get("/api/v1/events", headers={"Authorization": "Bearer part1.part2.part3"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_uses_oidc_auth_source(client, monkeypatch, oidc_settings_override):
    async def fake_verify(_: str):
        return OIDCVerificationResult(claims={"preferred_username": "mark"})

    monkeypatch.setattr("app.auth.verify_oidc_token", fake_verify)
    response = await client.get("/api/v1/me", headers={"Authorization": "Bearer part1.part2.part3"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["data"]["principal"] == "mark"
    assert payload["data"]["role"] == "admin"
    assert payload["data"]["auth_source"] == "oidc"
