import pytest


@pytest.mark.asyncio
async def test_events_requires_auth(client):
    response = await client.get("/api/v1/events")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_invalid_token_rejected(client):
    response = await client.get(
        "/api/v1/events",
        headers={"Authorization": "Bearer does_not_exist"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_revoked_token_rejected(client, revoked_headers):
    response = await client.get("/api/v1/events", headers=revoked_headers)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_reader_cannot_post_events(client, reader_headers):
    response = await client.post(
        "/api/v1/events",
        headers=reader_headers,
        json={"category": "other", "summary": "should fail"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_last_seen_updates(client, db_conn, writer_headers):
    await client.get("/api/v1/events", headers=writer_headers)

    row = await db_conn.fetchrow(
        "SELECT last_seen_at FROM principals WHERE name = 'codex_b'"
    )
    assert row is not None
    assert row["last_seen_at"] is not None
