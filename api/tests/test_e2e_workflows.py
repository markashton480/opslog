"""End-to-end API workflow tests (M9.1).

These exercise full realistic scenarios across multiple endpoints.
"""

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_event(client, headers, server: str, category: str, summary: str, **extra):
    payload = {"server": server, "category": category, "summary": summary, **extra}
    r = await client.post("/api/v1/events", headers=headers, json=payload)
    assert r.status_code == 201, r.text
    return r.json()["data"]


async def _create_issue(client, headers, title: str, server: str = "agent-workspace", **extra):
    payload = {
        "title": title,
        "severity": "high",
        "server": server,
        "symptoms": "Automated test symptom",
        "tags": ["e2e"],
        **extra,
    }
    r = await client.post("/api/v1/issues", headers=headers, json=payload)
    assert r.status_code == 201, r.text
    return r.json()["data"]


async def _patch_issue(client, headers, issue_id: str, version: int, **fields):
    r = await client.patch(
        f"/api/v1/issues/{issue_id}",
        headers=headers,
        json={"version": version, **fields},
    )
    assert r.status_code == 200, r.text
    return r.json()["data"]


async def _add_observation(client, headers, issue_id: str, content: str, occurred_at=None):
    payload = {"content": content}
    if occurred_at:
        payload["occurred_at"] = occurred_at.isoformat()
    r = await client.post(f"/api/v1/issues/{issue_id}/updates", headers=headers, json=payload)
    assert r.status_code == 201, r.text
    return r.json()["data"]


# ---------------------------------------------------------------------------
# 9.1.1  Full lifecycle workflow
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_full_lifecycle_workflow(client, writer_headers):
    """server → events → issue → updates → resolve → briefing consistency."""
    # 1. Create events
    ev1 = await _create_event(
        client, writer_headers, "agent-workspace", "deployment",
        summary="Deployed v2.0.0", tags=["release"],
    )
    ev2 = await _create_event(
        client, writer_headers, "agent-workspace", "observation",
        summary="High memory usage after deploy", tags=["memory"],
    )
    assert ev1["server_name"] == "agent-workspace"
    assert ev2["server_name"] == "agent-workspace"

    # 2. Create issue referencing symptoms
    issue = await _create_issue(
        client, writer_headers, "Memory leak after v2.0.0 deploy",
        symptoms="RSS grows to 4GB within 30min of deploy",
    )
    issue_id = issue["id"]
    assert issue["status"] == "open"
    assert issue["severity"] == "high"

    # 3. Transition: open → investigating → watching → resolved
    v = issue["version"]
    issue = await _patch_issue(client, writer_headers, issue_id, v, status="investigating")
    v = issue["version"]
    issue = await _patch_issue(
        client, writer_headers, issue_id, v,
        status="watching", root_cause="Memory leak in connection pool",
    )
    v = issue["version"]
    issue = await _patch_issue(client, writer_headers, issue_id, v, status="resolved")
    assert issue["status"] == "resolved"
    assert issue["resolved_at"] is not None

    # 4. Add observation after resolution (re-open)
    issue = await _patch_issue(client, writer_headers, issue_id, issue["version"], status="open")
    assert issue["resolved_at"] is None
    await _add_observation(client, writer_headers, issue_id, "Reproduced after restart")

    # 5. Check briefing includes everything
    briefing = await client.get(
        "/api/v1/servers/agent-workspace/briefing", headers=writer_headers,
    )
    assert briefing.status_code == 200
    data = briefing.json()["data"]
    assert data["server"]["name"] == "agent-workspace"
    # Our events should be in recent_events
    event_ids = {e["id"] for e in data["recent_events"]}
    assert ev1["id"] in event_ids
    assert ev2["id"] in event_ids
    # Our issue should be in open_issues (it was re-opened)
    issue_ids = {i["id"] for i in data["open_issues"]}
    assert issue_id in issue_ids

    # 6. Verify issue detail has full timeline
    detail = await client.get(f"/api/v1/issues/{issue_id}", headers=writer_headers)
    assert detail.status_code == 200
    updates = detail.json()["data"]["updates"]
    # Should have: open→investigating, investigating→watching+root_cause, watching→resolved,
    # resolved→open, observation
    assert len(updates) >= 4


# ---------------------------------------------------------------------------
# 9.1.2  Multi-principal attribution
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_multi_principal_attribution(client, writer_headers, admin_headers):
    """Different tokens produce events attributed to different principals."""
    ev_writer = await _create_event(
        client, writer_headers, "agent-workspace", "observation",
        summary="Writer observation",
    )
    ev_admin = await _create_event(
        client, admin_headers, "agent-workspace", "observation",
        summary="Admin observation",
    )
    assert ev_writer["principal"] == "codex_b"
    assert ev_admin["principal"] == "mark"

    # Both visible in event list
    listing = await client.get(
        "/api/v1/events?server=agent-workspace", headers=writer_headers,
    )
    assert listing.status_code == 200
    ids = {e["id"] for e in listing.json()["data"]}
    assert ev_writer["id"] in ids
    assert ev_admin["id"] in ids


# ---------------------------------------------------------------------------
# 9.1.3  Correction flow
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_correction_flow(client, writer_headers):
    """Create event → create correction → verify linkage."""
    original = await _create_event(
        client, writer_headers, "agent-workspace", "observation",
        summary="Disk usage at 95%",
    )
    correction = await _create_event(
        client, writer_headers, "agent-workspace", "observation",
        summary="Correction: disk usage actually 55%",
        corrects_event_id=original["id"],
    )
    assert correction["corrects_event_id"] == original["id"]

    # The correction event points back to the original
    fetched = await client.get(f"/api/v1/events/{correction['id']}", headers=writer_headers)
    assert fetched.status_code == 200
    assert fetched.json()["data"]["corrects_event_id"] == original["id"]

    # Verify the has_correction filter picks up the original
    listing = await client.get(
        "/api/v1/events?has_correction=true", headers=writer_headers,
    )
    assert listing.status_code == 200
    corrected_ids = {e["id"] for e in listing.json()["data"]}
    assert original["id"] in corrected_ids


# ---------------------------------------------------------------------------
# 9.1.4  CI event flow — structured metadata
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ci_event_structured_metadata(client, writer_headers):
    """Log a CI pipeline result with structured metadata."""
    metadata = {
        "pipeline": "ci.yml",
        "run_id": 12345,
        "status": "success",
        "duration_seconds": 142,
        "commit": "abc1234",
    }
    ev = await _create_event(
        client, writer_headers, "agent-workspace", "ci",
        summary="CI pipeline passed",
        tags=["ci", "pipeline"],
        metadata=metadata,
    )
    assert ev["metadata"] == metadata

    # Fetch by ID and verify metadata preserved
    fetched = await client.get(f"/api/v1/events/{ev['id']}", headers=writer_headers)
    assert fetched.status_code == 200
    assert fetched.json()["data"]["metadata"] == metadata


# ---------------------------------------------------------------------------
# 9.1.5  Issue relationship cross-references
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_issue_cross_references_in_briefing(client, writer_headers):
    """Issues with relationships appear correctly in briefing."""
    issue_a = await _create_issue(client, writer_headers, "Root cause issue")
    issue_b = await _create_issue(client, writer_headers, "Symptom issue")

    # Link B as caused_by A
    relate = await client.post(
        f"/api/v1/issues/{issue_b['id']}/relate",
        headers=writer_headers,
        json={"related_issue_id": issue_a["id"], "relationship": "caused_by"},
    )
    assert relate.status_code == 200

    # Both issues should appear in server briefing
    briefing = await client.get(
        "/api/v1/servers/agent-workspace/briefing", headers=writer_headers,
    )
    data = briefing.json()["data"]
    briefing_ids = {i["id"] for i in data["open_issues"]}
    assert issue_a["id"] in briefing_ids
    assert issue_b["id"] in briefing_ids


# ---------------------------------------------------------------------------
# 9.1.6  Idempotency across the workflow
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_idempotent_event_creation(client, writer_headers):
    """Duplicate dedupe_key returns same event, not a new one."""
    payload = {
        "server": "agent-workspace",
        "category": "deployment",
        "summary": "Deploy v3.0",
        "dedupe_key": "deploy-v3-unique-key-e2e",
    }
    r1 = await client.post("/api/v1/events", headers=writer_headers, json=payload)
    assert r1.status_code == 201
    id1 = r1.json()["data"]["id"]

    r2 = await client.post("/api/v1/events", headers=writer_headers, json=payload)
    # Duplicate returns 200 (existing record) not 201 (created)
    assert r2.status_code == 200
    id2 = r2.json()["data"]["id"]

    assert id1 == id2

    # Only one event in listing with this summary
    listing = await client.get(
        "/api/v1/events?server=agent-workspace", headers=writer_headers,
    )
    matches = [e for e in listing.json()["data"] if e["summary"] == "Deploy v3.0"]
    assert len(matches) == 1


# ---------------------------------------------------------------------------
# 9.1.7  Read-only token cannot write
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_readonly_cannot_create_events(client, reader_headers):
    """Reader tokens should be rejected for write operations."""
    r = await client.post(
        "/api/v1/events",
        headers=reader_headers,
        json={
            "server": "agent-workspace",
            "category": "observation",
            "summary": "Should fail",
        },
    )
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# 9.1.8  Briefing with no data
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_briefing_empty_server(client, admin_headers, writer_headers):
    """Briefing for a server with no events/issues returns valid structure."""
    # Server creation requires admin role
    r = await client.put(
        "/api/v1/servers/empty-test-srv",
        headers=admin_headers,
        json={"display_name": "Empty Test Server", "environment": "test"},
    )
    assert r.status_code in (200, 201)

    briefing = await client.get(
        "/api/v1/servers/empty-test-srv/briefing", headers=writer_headers,
    )
    assert briefing.status_code == 200
    data = briefing.json()["data"]
    assert data["recent_events"] == []
    assert data["open_issues"] == []
