import pytest


@pytest.mark.asyncio
async def test_me_returns_legacy_identity(client, admin_headers):
    response = await client.get("/api/v1/me", headers=admin_headers)
    assert response.status_code == 200

    payload = response.json()
    assert payload["data"]["principal"] == "mark"
    assert payload["data"]["role"] == "admin"
    assert payload["data"]["auth_source"] == "token"


@pytest.mark.asyncio
async def test_me_requires_auth(client):
    response = await client.get("/api/v1/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_allows_reader_role(client, reader_headers):
    response = await client.get("/api/v1/me", headers=reader_headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["data"]["principal"] == "readonly"
    assert payload["data"]["role"] == "reader"
