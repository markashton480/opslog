import pytest
import asyncio


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


@pytest.mark.asyncio
async def test_event_dedupe_key_is_race_safe(client, writer_headers):
    payload = {
        "server": "agent-workspace",
        "category": "deployment",
        "summary": "Concurrent idempotent deploy",
        "dedupe_key": "deploy-race-1",
    }

    first, second = await asyncio.gather(
        client.post("/api/v1/events", headers=writer_headers, json=payload),
        client.post("/api/v1/events", headers=writer_headers, json=payload),
    )

    assert {first.status_code, second.status_code} == {200, 201}
    assert first.json()["data"]["id"] == second.json()["data"]["id"]
