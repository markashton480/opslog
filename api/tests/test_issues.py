from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest


async def _create_issue(client, headers, title: str, server: str = "agent-workspace") -> dict:
    response = await client.post(
        "/api/v1/issues",
        headers=headers,
        json={
            "title": title,
            "severity": "high",
            "server": server,
            "symptoms": "Intermittent failure",
            "tags": ["test"],
        },
    )
    assert response.status_code == 201
    return response.json()["data"]


@pytest.mark.asyncio
async def test_issue_lifecycle_sets_and_clears_resolved_at(client, writer_headers):
    issue = await _create_issue(client, writer_headers, "Issue lifecycle")

    p1 = await client.patch(
        f"/api/v1/issues/{issue['id']}",
        headers=writer_headers,
        json={"version": issue["version"], "status": "investigating"},
    )
    assert p1.status_code == 200
    i1 = p1.json()["data"]
    assert i1["status"] == "investigating"

    p2 = await client.patch(
        f"/api/v1/issues/{issue['id']}",
        headers=writer_headers,
        json={"version": i1["version"], "status": "watching"},
    )
    assert p2.status_code == 200
    i2 = p2.json()["data"]
    assert i2["status"] == "watching"

    p3 = await client.patch(
        f"/api/v1/issues/{issue['id']}",
        headers=writer_headers,
        json={"version": i2["version"], "status": "resolved"},
    )
    assert p3.status_code == 200
    i3 = p3.json()["data"]
    assert i3["status"] == "resolved"
    assert i3["resolved_at"] is not None

    p4 = await client.patch(
        f"/api/v1/issues/{issue['id']}",
        headers=writer_headers,
        json={"version": i3["version"], "status": "open"},
    )
    assert p4.status_code == 200
    i4 = p4.json()["data"]
    assert i4["status"] == "open"
    assert i4["resolved_at"] is None


@pytest.mark.asyncio
async def test_open_to_resolved_direct_transition_rejected(client, writer_headers):
    issue = await _create_issue(client, writer_headers, "Invalid direct resolve")

    response = await client.patch(
        f"/api/v1/issues/{issue['id']}",
        headers=writer_headers,
        json={"version": issue["version"], "status": "resolved"},
    )
    assert response.status_code == 422
    assert "invalid status transition" in response.json()["data"]["error"]


@pytest.mark.asyncio
async def test_invalid_last_occurrence_patch_returns_422(client, writer_headers):
    issue = await _create_issue(client, writer_headers, "Invalid occurrence")

    first_seen = datetime.fromisoformat(issue["first_seen"].replace("Z", "+00:00"))
    invalid_occurrence = first_seen - timedelta(hours=1)

    response = await client.patch(
        f"/api/v1/issues/{issue['id']}",
        headers=writer_headers,
        json={"version": issue["version"], "last_occurrence": invalid_occurrence.isoformat()},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_issue_patch_optimistic_concurrency(client, writer_headers):
    issue = await _create_issue(client, writer_headers, "Concurrency")

    success = await client.patch(
        f"/api/v1/issues/{issue['id']}",
        headers=writer_headers,
        json={"version": issue["version"], "status": "investigating"},
    )
    assert success.status_code == 200

    stale = await client.patch(
        f"/api/v1/issues/{issue['id']}",
        headers=writer_headers,
        json={"version": issue["version"], "status": "watching"},
    )
    assert stale.status_code == 409
    payload = stale.json()
    assert payload["data"]["error"] == "version_conflict"
    assert payload["data"]["current"]["status"] == "investigating"


@pytest.mark.asyncio
async def test_patch_creates_structured_diff_update(client, writer_headers):
    issue = await _create_issue(client, writer_headers, "Diff test")

    patched = await client.patch(
        f"/api/v1/issues/{issue['id']}",
        headers=writer_headers,
        json={
            "version": issue["version"],
            "status": "investigating",
            "root_cause": "Database lock contention",
        },
    )
    assert patched.status_code == 200

    detail = await client.get(f"/api/v1/issues/{issue['id']}", headers=writer_headers)
    assert detail.status_code == 200
    updates = detail.json()["data"]["updates"]
    assert len(updates) == 1
    changes = updates[0]["changes"]
    assert changes["status"]["from"] == "open"
    assert changes["status"]["to"] == "investigating"
    assert changes["root_cause"]["to"] == "Database lock contention"


@pytest.mark.asyncio
async def test_issue_observation_update_bumps_last_occurrence(client, writer_headers):
    issue = await _create_issue(client, writer_headers, "Observation test")

    observed_at = datetime.now(UTC) + timedelta(hours=2)
    update_response = await client.post(
        f"/api/v1/issues/{issue['id']}/updates",
        headers=writer_headers,
        json={"content": "Observed again", "occurred_at": observed_at.isoformat()},
    )
    assert update_response.status_code == 201

    detail = await client.get(f"/api/v1/issues/{issue['id']}", headers=writer_headers)
    assert detail.status_code == 200
    issue_data = detail.json()["data"]["issue"]
    assert issue_data["last_occurrence"] >= observed_at.isoformat()


@pytest.mark.asyncio
async def test_related_issues_relationships_and_duplicate_uniqueness(client, writer_headers, db_conn):
    a = await _create_issue(client, writer_headers, "Issue A")
    b = await _create_issue(client, writer_headers, "Issue B")
    c = await _create_issue(client, writer_headers, "Issue C")
    d = await _create_issue(client, writer_headers, "Issue D")

    caused_by = await client.post(
        f"/api/v1/issues/{a['id']}/relate",
        headers=writer_headers,
        json={"related_issue_id": b["id"], "relationship": "caused_by"},
    )
    assert caused_by.status_code == 200
    assert caused_by.json()["data"]["relationship"] == "caused_by"

    related = await client.post(
        f"/api/v1/issues/{c['id']}/relate",
        headers=writer_headers,
        json={"related_issue_id": a["id"], "relationship": "related"},
    )
    assert related.status_code == 200
    rel = related.json()["data"]
    assert rel["relationship"] == "related"
    assert UUID(rel["src_issue_id"]).int < UUID(rel["dst_issue_id"]).int

    duplicate_ok = await client.post(
        f"/api/v1/issues/{d['id']}/relate",
        headers=writer_headers,
        json={"related_issue_id": a["id"], "relationship": "duplicate_of"},
    )
    assert duplicate_ok.status_code == 200

    duplicate_conflict = await client.post(
        f"/api/v1/issues/{d['id']}/relate",
        headers=writer_headers,
        json={"related_issue_id": b["id"], "relationship": "duplicate_of"},
    )
    assert duplicate_conflict.status_code == 422

    count = await db_conn.fetchval(
        "SELECT COUNT(*) FROM related_issues WHERE src_issue_id = $1::uuid AND relationship = 'duplicate_of'",
        d["id"],
    )
    assert count == 1
