# OpsLog — Agent Usage Guide

Quick-reference for AI agents (and humans) using the OpsLog API from scripts or
terminal sessions.

## Authentication

Every request needs a Bearer token:

```bash
export OPSLOG=https://opslog.lintel.digital
export TOKEN=opslog_<principal>_<secret>
alias oapi='curl -sf -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json"'
```

## Common Workflows

### 1. Start-of-session briefing

```bash
oapi "$OPSLOG/api/v1/servers/agent-workspace/briefing" | python3 -m json.tool
```

Returns: server metadata, recent events, and open issues.

### 2. Log a deployment event

```bash
oapi -X POST "$OPSLOG/api/v1/events" -d '{
  "server": "agent-workspace",
  "category": "deployment",
  "summary": "Deployed myapp v2.1.0",
  "tags": ["release", "myapp"],
  "metadata": {"ref": "v2.1.0", "commit": "abc1234"},
  "dedupe_key": "deploy-myapp-v2.1.0"
}'
```

The `dedupe_key` prevents duplicate entries if the request is retried.

### 3. Log an observation

```bash
oapi -X POST "$OPSLOG/api/v1/events" -d '{
  "server": "agent-workspace",
  "category": "observation",
  "summary": "High memory usage: RSS at 3.2GB",
  "tags": ["memory", "performance"]
}'
```

### 4. Correct a previous event

```bash
oapi -X POST "$OPSLOG/api/v1/events" -d '{
  "server": "agent-workspace",
  "category": "observation",
  "summary": "Correction: RSS was actually 1.2GB (misread htop output)",
  "corrects_event_id": "<original-event-uuid>"
}'
```

### 5. Report an issue

```bash
oapi -X POST "$OPSLOG/api/v1/issues" -d '{
  "title": "API response times degraded after deploy",
  "severity": "high",
  "server": "agent-workspace",
  "symptoms": "P99 latency > 500ms on /api/v1/events endpoint",
  "tags": ["performance", "api"]
}'
```

Severity levels: `critical`, `high`, `medium`, `low`.

### 6. Update an issue (status transition)

```bash
# Get current version first
ISSUE=$(oapi "$OPSLOG/api/v1/issues/<issue-uuid>")
VERSION=$(echo "$ISSUE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['issue']['version'])")

# Transition: open → investigating → watching → resolved
oapi -X PATCH "$OPSLOG/api/v1/issues/<issue-uuid>" -d "{
  \"version\": $VERSION,
  \"status\": \"investigating\",
  \"root_cause\": \"Connection pool exhaustion after deploy\"
}"
```

Valid transitions: `open` → `investigating` → `watching` → `resolved` (and back
to `open`). Also: `open` → `wontfix` → `open`.

### 7. Add an observation to an issue

```bash
oapi -X POST "$OPSLOG/api/v1/issues/<issue-uuid>/updates" -d '{
  "content": "Confirmed: pool size was set to 5, should be 50. Fixed in v2.1.1."
}'
```

### 8. List recent events (with filters)

```bash
# All events for a server
oapi "$OPSLOG/api/v1/events?server=agent-workspace&limit=20"

# Filter by category
oapi "$OPSLOG/api/v1/events?category=deployment&limit=10"

# Filter by time range
oapi "$OPSLOG/api/v1/events?since=2025-01-01T00:00:00Z&until=2025-01-31T23:59:59Z"
```

### 9. List issues (with filters)

```bash
# Open issues for a server
oapi "$OPSLOG/api/v1/issues?server=agent-workspace&status=open"

# Filter by severity (comma-separated)
oapi "$OPSLOG/api/v1/issues?severity=critical,high"
```

## Event Categories

| Category | Use For |
|---|---|
| `deployment` | Code releases, rollbacks |
| `config_change` | Config file edits, env var changes |
| `dns` | DNS record changes |
| `service` | Service restarts, scaling |
| `security` | Cert rotations, firewall changes, access grants |
| `backup` | Backup runs, restores |
| `network` | Network changes, VPN, routing |
| `account` | User/key management |
| `infra` | Hardware, VM, resource changes |
| `ci` | CI/CD pipeline results |
| `observation` | General observations, monitoring alerts |
| `other` | Anything that doesn't fit above |

## API Reference

Full interactive API documentation (Swagger UI) is available when accessing
the API service directly (not via the public reverse proxy):

```
http://localhost:8600/docs
```

> **Note:** The public URL (`https://opslog.lintel.digital`) proxies only `/api/v1/*`
> to the backend. Swagger UI at `/docs` is only accessible via direct API access.
