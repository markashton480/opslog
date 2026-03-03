import pytest


@pytest.mark.asyncio
async def test_event_dedupe_key_returns_existing_record(client, writer_headers):
    payload = {
        "server": "agent-workspace",
        "category": "deployment",
        "summary": "Idempotent deploy",
        "dedupe_key": "deploy-42",
    }

    first = await client.post("/api/v1/events", headers=writer_headers, json=payload)
    assert first.status_code == 201

    second = await client.post("/api/v1/events", headers=writer_headers, json=payload)
    assert second.status_code == 200

    assert second.json()["data"]["id"] == first.json()["data"]["id"]
