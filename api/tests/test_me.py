import pytest


@pytest.mark.asyncio
async def test_me_returns_legacy_identity(client, admin_headers):
    response = await client.get("/api/v1/me", headers=admin_headers)
    assert response.status_code == 200

    payload = response.json()
    assert payload["data"]["principal"] == "mark"
    assert payload["data"]["role"] == "admin"
    assert payload["data"]["auth_source"] == "token"
