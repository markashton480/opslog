import pytest


@pytest.mark.asyncio
async def test_cursor_pagination(client, writer_headers):
    for idx in range(5):
        response = await client.post(
            "/api/v1/events",
            headers=writer_headers,
            json={
                "server": "agent-workspace",
                "category": "observation",
                "summary": f"Event {idx}",
            },
        )
        assert response.status_code == 201

    page_one = await client.get(
        "/api/v1/events",
        headers=writer_headers,
        params={"limit": 2},
    )
    assert page_one.status_code == 200
    payload_one = page_one.json()
    assert len(payload_one["data"]) == 2
    assert payload_one["has_more"] is True
    assert payload_one["next_cursor"] is not None

    page_two = await client.get(
        "/api/v1/events",
        headers=writer_headers,
        params={"limit": 2, "cursor": payload_one["next_cursor"]},
    )
    assert page_two.status_code == 200
    payload_two = page_two.json()
    assert len(payload_two["data"]) == 2

    first_page_ids = {item["id"] for item in payload_one["data"]}
    second_page_ids = {item["id"] for item in payload_two["data"]}
    assert first_page_ids.isdisjoint(second_page_ids)


@pytest.mark.asyncio
async def test_offset_pagination(client, writer_headers):
    for idx in range(3):
        response = await client.post(
            "/api/v1/events",
            headers=writer_headers,
            json={
                "server": "agent-workspace",
                "category": "observation",
                "summary": f"Offset Event {idx}",
            },
        )
        assert response.status_code == 201

    response = await client.get(
        "/api/v1/events",
        headers=writer_headers,
        params={"limit": 1, "offset": 1},
    )
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["data"]) == 1
