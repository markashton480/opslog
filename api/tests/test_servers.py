import pytest


@pytest.mark.asyncio
async def test_server_admin_only_mutations(client, writer_headers, admin_headers):
    denied_put = await client.put(
        "/api/v1/servers/new-node",
        headers=writer_headers,
        json={"display_name": "New Node", "private_ipv4": "10.44.0.10", "status": "active"},
    )
    assert denied_put.status_code == 403

    created = await client.put(
        "/api/v1/servers/new-node",
        headers=admin_headers,
        json={"display_name": "New Node", "private_ipv4": "10.44.0.10", "status": "active"},
    )
    assert created.status_code == 200
    assert created.json()["data"]["name"] == "new-node"

    denied_alias = await client.post(
        "/api/v1/servers/new-node/aliases",
        headers=writer_headers,
        json={"alias": "new-old"},
    )
    assert denied_alias.status_code == 403

    created_alias = await client.post(
        "/api/v1/servers/new-node/aliases",
        headers=admin_headers,
        json={"alias": "new-old"},
    )
    assert created_alias.status_code == 201

    denied_delete = await client.delete(
        "/api/v1/servers/new-node/aliases/new-old",
        headers=writer_headers,
    )
    assert denied_delete.status_code == 403

    deleted = await client.delete(
        "/api/v1/servers/new-node/aliases/new-old",
        headers=admin_headers,
    )
    assert deleted.status_code == 200


@pytest.mark.asyncio
async def test_servers_list_and_briefing_with_alias_resolution(client, admin_headers, writer_headers):
    alias_response = await client.post(
        "/api/v1/servers/lintel-tools-01/aliases",
        headers=admin_headers,
        json={"alias": "tools-primary"},
    )
    assert alias_response.status_code == 201

    event_response = await client.post(
        "/api/v1/events",
        headers=writer_headers,
        json={
            "server": "tools-primary",
            "category": "deployment",
            "summary": "Deploy via alias",
            "tags": ["deploy"],
        },
    )
    assert event_response.status_code == 201
    assert event_response.json()["warnings"] == []
    assert event_response.json()["data"]["server_id"] is not None

    issue_response = await client.post(
        "/api/v1/issues",
        headers=writer_headers,
        json={
            "title": "Alias server issue",
            "severity": "high",
            "server": "tools-primary",
            "symptoms": "service unstable",
        },
    )
    assert issue_response.status_code == 201

    servers = await client.get("/api/v1/servers", headers=writer_headers)
    assert servers.status_code == 200
    tools = [item for item in servers.json()["data"] if item["name"] == "lintel-tools-01"][0]
    assert "tools-primary" in tools["aliases"]

    briefing = await client.get("/api/v1/servers/tools-primary/briefing", headers=writer_headers)
    assert briefing.status_code == 200
    payload = briefing.json()["data"]
    assert payload["server"]["name"] == "lintel-tools-01"
    assert "tools-primary" in payload["server"]["aliases"]
    assert payload["summary"]["events_last_24h"] >= 1
    assert payload["summary"]["open_issue_count"] >= 1
    assert payload["summary"]["last_deployment"] is not None
    assert any(item["summary"] == "Deploy via alias" for item in payload["recent_events"])
    assert any(item["title"] == "Alias server issue" for item in payload["open_issues"])
