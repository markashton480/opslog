import pytest


@pytest.mark.asyncio
async def test_health_endpoint(client):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200

    payload = response.json()
    assert payload["data"]["status"] == "ok"
    assert payload["data"]["db"] == "connected"
    assert payload["data"]["version"] == "0.3.0"
    assert isinstance(payload["data"]["uptime_seconds"], int)
    assert payload["warnings"] == []


@pytest.mark.asyncio
async def test_categories_endpoint(client):
    response = await client.get("/api/v1/categories")
    assert response.status_code == 200

    payload = response.json()
    categories = payload["data"]["categories"]
    assert any(item["name"] == "deployment" for item in categories)
    assert all("description" in item for item in categories)
