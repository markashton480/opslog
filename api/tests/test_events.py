import pytest


@pytest.mark.asyncio
async def test_create_event_and_fetch_by_id(client, writer_headers):
    create_response = await client.post(
        "/api/v1/events",
        headers=writer_headers,
        json={
            "server": "agent-workspace",
            "category": "deployment",
            "summary": "Deployed release 1.2.3",
            "tags": ["release", "api"],
            "metadata": {"ref": "v1.2.3"},
        },
    )
    assert create_response.status_code == 201

    created = create_response.json()
    assert created["warnings"] == []
    assert created["data"]["principal"] == "codex_b"
    assert created["data"]["server_name"] == "agent-workspace"

    event_id = created["data"]["id"]
    get_response = await client.get(f"/api/v1/events/{event_id}", headers=writer_headers)
    assert get_response.status_code == 200
    assert get_response.json()["data"]["id"] == event_id


@pytest.mark.asyncio
async def test_unknown_server_is_accepted_with_warning(client, writer_headers):
    response = await client.post(
        "/api/v1/events",
        headers=writer_headers,
        json={
            "server": "unknown-node-99",
            "category": "observation",
            "summary": "Observed something",
        },
    )
    assert response.status_code == 201

    payload = response.json()
    assert payload["data"]["server_id"] is None
    assert payload["warnings"] == ["unknown-server: unknown-node-99"]


@pytest.mark.asyncio
async def test_list_events_filters(client, writer_headers):
    await client.post(
        "/api/v1/events",
        headers=writer_headers,
        json={
            "server": "agent-workspace",
            "category": "deployment",
            "summary": "Deploy A",
            "tags": ["deploy"],
        },
    )
    await client.post(
        "/api/v1/events",
        headers=writer_headers,
        json={
            "server": "agent-workspace",
            "category": "service",
            "summary": "Service restart",
            "tags": ["ops"],
        },
    )

    response = await client.get(
        "/api/v1/events",
        headers=writer_headers,
        params={"category": "deployment", "tag": "deploy", "server": "agent-workspace"},
    )
    assert response.status_code == 200

    payload = response.json()
    assert len(payload["data"]) == 1
    assert payload["data"][0]["category"] == "deployment"


@pytest.mark.asyncio
async def test_has_correction_filter(client, writer_headers):
    original = await client.post(
        "/api/v1/events",
        headers=writer_headers,
        json={
            "server": "agent-workspace",
            "category": "other",
            "summary": "Needs correction",
        },
    )
    original_id = original.json()["data"]["id"]

    await client.post(
        "/api/v1/events",
        headers=writer_headers,
        json={
            "server": "agent-workspace",
            "category": "observation",
            "summary": "Correction event",
            "corrects_event_id": original_id,
        },
    )

    corrected_only = await client.get(
        "/api/v1/events",
        headers=writer_headers,
        params={"has_correction": "true"},
    )
    assert corrected_only.status_code == 200
    corrected_ids = {item["id"] for item in corrected_only.json()["data"]}
    assert original_id in corrected_ids


@pytest.mark.asyncio
async def test_detail_size_validation(client, writer_headers):
    large_detail = "x" * ((200 * 1024) + 1)
    response = await client.post(
        "/api/v1/events",
        headers=writer_headers,
        json={"category": "other", "summary": "Too large detail", "detail": large_detail},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_request_body_too_large(client, writer_headers):
    too_large_summary = "x" * (513 * 1024)
    response = await client.post(
        "/api/v1/events",
        headers=writer_headers,
        json={"category": "other", "summary": too_large_summary},
    )
    assert response.status_code == 413
