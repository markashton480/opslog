# Lintel OpsLog — Design Specification

**Version:** 0.3  
**Date:** 2026-03-02  
**Status:** Design review  

**Changelog:**

- v0.1 — Initial design.
- v0.2 — Addressed 20-point review: auth, stable server identity, dual timestamps, DB invariants, cursor pagination, idempotency, optimistic concurrency, structured diffs, payload limits.
- v0.3 — Added `claude` and `ci_runner` principals from updated accounts.yml/runners.yml. Added `ci` event category for pipeline/runner activity. Added full dashboard design (React/Vite/TSX SPA) with fleet overview, event stream, issues board, and server detail views. Noted servers.yml drift (private network fields stripped). Minor cleanups throughout.

---

## Purpose

A centralised, write-optimised event log and issue tracker for the Lintel infrastructure. Designed to be consumed and written to by AI agents (Claude Code, Codex A/B/C) and human operators via a simple REST API.

Complements (does not replace) the existing YAML-based infrastructure-as-code files in `lintel-ops`. The YAML files remain the canonical snapshot of *desired state*; OpsLog records *what happened and when*.

### Problems it solves

- Agents forget to commit/push changelog updates after server work
- The WBLT (Watched Bug List & Tickets) has no structured lifecycle tracking
- No way to ask "what happened on this server recently?" without reading git log
- Merge conflicts when multiple agents update the same YAML file
- Infrastructure state drifts from what the YAML files describe (e.g. server renames, missing fields)

---

## Deployment

| Property         | Value                                            |
|------------------|--------------------------------------------------|
| **Host**         | lintel-tools-01 (or lintel-tools-02)             |
| **Stack**        | FastAPI + PostgreSQL, direct on host              |
| **Network**      | Listens on private network (10.44.0.x)           |
| **Auth**         | Bearer token per principal (see Authentication)  |
| **Port**         | TBD (suggest 8600)                               |
| **Base URL**     | `http://10.44.0.x:8600/api/v1`                  |

---

## Authentication & identity

### Principals

Every API consumer has a **principal** — a verified identity derived from their bearer token, never from request body fields. The principal is the system-of-record for "who did this."

| Principal    | Role    | Permissions                                        | Notes                                  |
|--------------|---------|----------------------------------------------------|----------------------------------------|
| `mark`       | admin   | All operations including server registry management | Primary human operator                |
| `claude`     | writer  | POST events/issues/updates, GET all, PATCH issues  | Claude Code agent                     |
| `codex_a`    | writer  | Same as above                                      | Codex agent slot A                    |
| `codex_b`    | writer  | Same as above                                      | Codex agent slot B                    |
| `codex_c`    | writer  | Same as above                                      | Codex agent slot C                    |
| `sum-cli`    | writer  | Same as above                                      | SUM platform CLI (automated deploys)  |
| `ci_runner`  | writer  | Same as above                                      | Gitea Act runner (pipeline events)    |
| `readonly`   | reader  | GET only — briefings, queries, health              | Dashboards, monitoring                |

### Token scheme

Bearer tokens, one per principal, stored hashed (SHA-256) in a `principals` table. Tokens are generated during provisioning and distributed to agents via their environment or SSH config.

```
Authorization: Bearer opslog_claude_<random>
```

The API resolves the token → principal on every request. The `principal` field is written to every event, issue, and update record. Agents may optionally send a `reported_agent` field in the request body for display purposes (e.g. if `sum-cli` acts on behalf of a specific agent), but it has no authority.

### Permission model

| Role    | POST events | POST issues | PATCH issues | GET * | PUT servers | Manage principals |
|---------|-------------|-------------|--------------|-------|-------------|-------------------|
| admin   | ✓           | ✓           | ✓            | ✓     | ✓           | ✓                 |
| writer  | ✓           | ✓           | ✓            | ✓     | ✗           | ✗                 |
| reader  | ✗           | ✗           | ✗            | ✓     | ✗           | ✗                 |

### `principals` table

| Column         | Type         | Constraints                   | Notes                                         |
|----------------|--------------|-------------------------------|-----------------------------------------------|
| `name`         | text         | **PK**                        | e.g. `claude`, `codex_a`                      |
| `role`         | text         | not null                      | `admin` / `writer` / `reader`                 |
| `token_hash`   | text         | not null, unique              | SHA-256 of bearer token                       |
| `status`       | text         | not null, default `active`    | `active` / `revoked`                          |
| `created_at`   | timestamptz  | not null, default now()       |                                               |
| `last_seen_at` | timestamptz  | nullable                      | Updated on each authenticated request         |

**DB constraints:**

- `CHECK (role IN ('admin', 'writer', 'reader'))`
- `CHECK (status IN ('active', 'revoked'))`

---

## Data model

### Design principles

- **Events are immutable.** Enforced at the database layer via a trigger that raises on UPDATE/DELETE, and by DB role restrictions (no DELETE grant). Corrections are first-class: `corrects_event_id` column, not buried in metadata.
- **Issues are mutable** with optimistic concurrency (`version` field). All changes tracked in `issue_updates` with structured diffs.
- **Metadata is freeform** JSONB, but payload sizes are constrained.
- **Server identity is stable.** Servers have a UUID primary key with a mutable canonical name and an alias table for historical names. Events record both `server_id` (resolved, stable) and `server_name` (as-reported, immutable).
- **Dual timestamps.** Every record has `occurred_at` (client-reported) and `ingested_at` (server-set, immutable). Ordering and pagination use `ingested_at` by default.
- **Identity is derived from auth**, never from request body.
- **Idempotency built in.** Writers can supply a `dedupe_key` to prevent duplicate inserts on retry.

### Entity-relationship overview

```
principals
    │
    ├──→ events ←── issues ──< issue_updates
    │       │          │
    │       │    related_issues
    │       │
    │       └── corrects → events (self-ref)
    │
    └──→ servers ──< server_aliases
```

### `servers`

Stable identity for infrastructure. UUID primary key survives renames.

| Column        | Type         | Constraints                       | Notes                         |
|---------------|--------------|-----------------------------------|-------------------------------|
| `id`          | uuid         | **PK**, default gen_random_uuid() | Stable identity               |
| `name`        | text         | not null, **unique**              | Current canonical name        |
| `display_name`| text         | not null                          | e.g. `Production`             |
| `private_ipv4`| inet         | nullable                          | Proper Postgres inet type     |
| `status`      | text         | not null, default `active`        | `active` / `decommissioned`   |
| `notes`       | text         | nullable                          |                               |
| `created_at`  | timestamptz  | not null, default now()           |                               |
| `updated_at`  | timestamptz  | not null, default now()           | Auto-bumped by trigger        |

**DB constraints:**

- `CHECK (status IN ('active', 'decommissioned'))`
- Trigger: `updated_at = now()` on UPDATE

### `server_aliases`

Historical and alternative names for servers. Allows continuity across renames.

| Column      | Type         | Constraints                       | Notes                                |
|-------------|--------------|-----------------------------------|--------------------------------------|
| `server_id` | uuid         | not null, FK → servers            |                                      |
| `alias_name`| text         | not null, **unique**              | e.g. `coolify` (the old name)        |
| `created_at`| timestamptz  | not null, default now()           |                                      |
| **PK**      |              | (`server_id`, `alias_name`)       |                                      |

**Resolution rule on write:** When a request includes a server name, the API resolves it by checking `servers.name` first, then `server_aliases.alias_name`. If found → `server_id` is set. If not found → `server_id` = NULL, `server_name` is preserved as-reported, and a warning is returned. Later, adding an alias retroactively links orphaned events via a background reconciliation query (optional, not in v0.3).

### `events`

The core append-only log. Immutability enforced by database trigger.

| Column              | Type         | Constraints                          | Notes                                           |
|---------------------|--------------|--------------------------------------|-------------------------------------------------|
| `id`                | uuid         | **PK**, default gen_random_uuid()    |                                                 |
| `occurred_at`       | timestamptz  | not null, default now()              | When it happened (client can override)           |
| `ingested_at`       | timestamptz  | not null, default now()              | When OpsLog recorded it (server-set, immutable)  |
| `principal`         | text         | not null                             | Derived from auth token                          |
| `reported_agent`    | text         | nullable                             | Optional display name from request body          |
| `server_id`         | uuid         | nullable, FK → servers               | Resolved at write time. Stable across renames    |
| `server_name`       | text         | nullable                             | As-reported by client. Immutable                 |
| `category`          | text         | not null                             | Enforced via CHECK                               |
| `summary`           | text         | not null                             | Max 1024 chars                                   |
| `detail`            | text         | nullable                             | Max 200 KB                                       |
| `tags`              | text[]       | not null, default '{}'               | Freeform array                                   |
| `issue_id`          | uuid         | nullable, FK → issues                | Links event to an issue                          |
| `corrects_event_id` | uuid         | nullable, FK → events                | First-class correction pointer                   |
| `metadata`          | jsonb        | not null, default '{}'               | Freeform; must be object; max 200 KB             |
| `dedupe_key`        | text         | nullable                             | For idempotent writes                            |

**DB constraints:**

- `CHECK (category IN ('deployment','config_change','dns','service','security','backup','network','account','infra','ci','observation','other'))`
- `CHECK (char_length(summary) <= 1024)`
- `CHECK (jsonb_typeof(metadata) = 'object')`
- `UNIQUE (principal, dedupe_key) WHERE dedupe_key IS NOT NULL`
- Trigger: RAISE on UPDATE or DELETE (immutability)

**Indexes:**

- `idx_events_server_ingested` on `(server_id, ingested_at DESC, id DESC)` — powers briefing queries
- `idx_events_server_occurred` on `(server_id, occurred_at DESC, id DESC)` — for chronological views
- `idx_events_category` on `(category)`
- `idx_events_principal` on `(principal)`
- `idx_events_tags` GIN on `(tags)`
- `idx_events_issue_id` on `(issue_id)`
- `idx_events_corrects` on `(corrects_event_id) WHERE corrects_event_id IS NOT NULL`
- `idx_events_dedupe` partial unique on `(principal, dedupe_key) WHERE dedupe_key IS NOT NULL`
- `idx_events_deploy` partial on `(server_id, occurred_at DESC) WHERE category = 'deployment'` — for "last deployment" in briefings

### Event categories (enforced as CHECK constraint)

| Category        | Use for                                                  |
|-----------------|----------------------------------------------------------|
| `deployment`    | Code deployed, promoted, rolled back                     |
| `config_change` | Server or service configuration modified                 |
| `dns`           | Record changes, zone updates, nameserver changes         |
| `service`       | Start/stop/restart/reload of services                    |
| `security`      | Firewall rules, SSH keys, fail2ban, access changes       |
| `backup`        | Backup runs, restores, retention changes                 |
| `network`       | Routing, Tailscale, private network changes              |
| `account`       | User/agent account creation, modification, key rotation  |
| `infra`         | Server provisioning, renaming, plan changes, migrations  |
| `ci`            | Pipeline runs, test results, runner events               |
| `observation`   | Noticed something but didn't change anything             |
| `other`         | Escape hatch for uncategorised events                    |

### `issues`

Replaces the WBLT (Watched Bug List & Tickets). Optimistic concurrency via `version` field.

| Column            | Type         | Constraints                          | Notes                               |
|-------------------|--------------|--------------------------------------|-------------------------------------|
| `id`              | uuid         | **PK**, default gen_random_uuid()    |                                     |
| `title`           | text         | not null                             | Max 512 chars                       |
| `status`          | text         | not null, default `open`             | Enforced via CHECK                  |
| `severity`        | text         | not null, default `medium`           | Enforced via CHECK                  |
| `server_id`       | uuid         | nullable, FK → servers               | Resolved at creation                |
| `server_name`     | text         | nullable                             | As-reported                         |
| `first_seen`      | timestamptz  | not null, default now()              |                                     |
| `last_occurrence` | timestamptz  | not null, default now()              |                                     |
| `symptoms`        | text         | nullable                             |                                     |
| `root_cause`      | text         | nullable                             |                                     |
| `solution`        | text         | nullable                             |                                     |
| `created_by`      | text         | not null                             | Principal from auth                 |
| `version`         | int          | not null, default 1                  | Optimistic concurrency              |
| `created_at`      | timestamptz  | not null, default now()              |                                     |
| `updated_at`      | timestamptz  | not null, default now()              | Auto-bumped by trigger              |
| `resolved_at`     | timestamptz  | nullable                             |                                     |
| `tags`            | text[]       | not null, default '{}'               |                                     |
| `metadata`        | jsonb        | not null, default '{}'               | Freeform; must be object; max 200KB |
| `dedupe_key`      | text         | nullable                             | Idempotent creation                 |

**DB constraints:**

- `CHECK (status IN ('open','investigating','watching','resolved','wontfix'))`
- `CHECK (severity IN ('critical','high','medium','low'))`
- `CHECK (char_length(title) <= 512)`
- `CHECK (jsonb_typeof(metadata) = 'object')`
- `CHECK (last_occurrence >= first_seen)`
- `CHECK ((status IN ('resolved','wontfix')) = (resolved_at IS NOT NULL))` — resolved ↔ resolved_at consistency
- `UNIQUE (created_by, dedupe_key) WHERE dedupe_key IS NOT NULL`
- Trigger: `updated_at = now()` on UPDATE
- Trigger: `version = version + 1` on UPDATE

**Issue status lifecycle:**

```
open → investigating → watching → resolved
  │         │              │          │
  │         │              └──→ open (recurrence)
  │         └──────────────→ resolved
  └────────────────────────→ wontfix
```

**Indexes:**

- `idx_issues_server_status` on `(server_id, status, updated_at DESC)` — powers briefing queries
- `idx_issues_open` partial on `(server_id, updated_at DESC) WHERE status IN ('open','investigating','watching')` — active issues
- `idx_issues_severity` on `(severity, updated_at DESC)`
- `idx_issues_dedupe` partial unique on `(created_by, dedupe_key) WHERE dedupe_key IS NOT NULL`

### `issue_updates`

Timeline entries within an issue. Immutable (enforced by trigger). Stores structured diffs.

| Column          | Type         | Constraints                       | Notes                                       |
|-----------------|--------------|-----------------------------------|---------------------------------------------|
| `id`            | uuid         | **PK**, default gen_random_uuid() |                                             |
| `issue_id`      | uuid         | not null, FK → issues             |                                             |
| `occurred_at`   | timestamptz  | not null, default now()           | Client-reported                              |
| `ingested_at`   | timestamptz  | not null, default now()           | Server-set                                   |
| `principal`     | text         | not null                          | From auth                                    |
| `content`       | text         | not null                          | Human-readable description of what happened  |
| `status_from`   | text         | nullable                          | Previous status (null if no transition)      |
| `status_to`     | text         | nullable                          | New status (null if no transition)           |
| `changes`       | jsonb        | not null, default '{}'            | Structured diff: `{"field": {"from": X, "to": Y}}` |

**DB constraints:**

- `CHECK (jsonb_typeof(changes) = 'object')`
- Trigger: RAISE on UPDATE or DELETE (immutability)

**Indexes:**

- `idx_issue_updates_timeline` on `(issue_id, occurred_at ASC, id ASC)` — chronological timeline

### `related_issues`

Directional relationships between issues.

| Column          | Type   | Constraints                                          | Notes                                    |
|-----------------|--------|------------------------------------------------------|------------------------------------------|
| `src_issue_id`  | uuid   | not null, FK → issues                                | The "from" side                          |
| `dst_issue_id`  | uuid   | not null, FK → issues                                | The "to" side                            |
| `relationship`  | text   | not null                                             | `related` / `caused_by` / `duplicate_of` |
| **PK**          |        | (`src_issue_id`, `dst_issue_id`, `relationship`)     |                                          |

**DB constraints:**

- `CHECK (src_issue_id <> dst_issue_id)`
- `CHECK (relationship IN ('related','caused_by','duplicate_of'))`
- For `related` (symmetric): enforce `src_issue_id < dst_issue_id` via CHECK — prevents storing both directions
- For `duplicate_of`: unique on `(src_issue_id) WHERE relationship = 'duplicate_of'` — an issue can only be a duplicate of one canonical issue

**Directionality semantics:**

- `caused_by`: src was caused by dst ("this issue was caused by that issue")
- `duplicate_of`: src is a duplicate of dst (dst is canonical)
- `related`: symmetric, stored with src < dst

---

## API specification

**Base URL:** `http://<lintel-tools-ip>:8600/api/v1`

All request/response bodies are JSON. Timestamps are ISO 8601 UTC. All endpoints require `Authorization: Bearer <token>` (except `/health` and `/categories`).

### Response envelope

All responses include a `warnings` array (may be empty):

```json
{
  "data": { ... },
  "warnings": ["unknown-server: foo-bar-01"]
}
```

For list endpoints:

```json
{
  "data": [ ... ],
  "next_cursor": "2026-03-02T14:30:00Z_a1b2c3d4",
  "has_more": true,
  "warnings": []
}
```

### Pagination

All list endpoints use **keyset (cursor) pagination** by default. The cursor encodes `(ingested_at, id)` as an opaque string.

| Param      | Type   | Notes                                                     |
|------------|--------|-----------------------------------------------------------|
| `cursor`   | string | Opaque cursor from `next_cursor` in previous response     |
| `limit`    | int    | Default 50, max 500 for events; default 20, max 100 for issues |

Offset pagination (`offset` param) is also supported for ad-hoc queries but is not recommended for agents.

### Idempotency

All POST endpoints accept an optional `dedupe_key` field. If a record with the same `(principal, dedupe_key)` already exists, the existing record is returned with status `200` instead of creating a duplicate (`201`).

### Events

#### `POST /events` — Log an event

```json
// Request
{
  "server": "lintel-prod-01",
  "category": "deployment",
  "summary": "Deployed sum-platform v2.4.1 to lintel-prod-01",
  "detail": "Promoted from staging after green test suite...",
  "tags": ["sum-platform", "release"],
  "issue_id": null,
  "corrects_event_id": null,
  "metadata": {
    "git_ref": "v2.4.1",
    "deploy_method": "sum promote"
  },
  "occurred_at": null,
  "reported_agent": null,
  "dedupe_key": "deploy-v2.4.1-prod-20260302"
}

// Response: 201 Created
{
  "data": {
    "id": "a1b2c3d4-...",
    "occurred_at": "2026-03-02T14:30:00Z",
    "ingested_at": "2026-03-02T14:30:01Z",
    "principal": "claude",
    "reported_agent": null,
    "server_id": "9f8e7d6c-...",
    "server_name": "lintel-prod-01",
    "category": "deployment",
    "summary": "Deployed sum-platform v2.4.1 to lintel-prod-01",
    "detail": "Promoted from staging after green test suite...",
    "tags": ["sum-platform", "release"],
    "issue_id": null,
    "corrects_event_id": null,
    "metadata": {"git_ref": "v2.4.1", "deploy_method": "sum promote"},
    "dedupe_key": "deploy-v2.4.1-prod-20260302"
  },
  "warnings": []
}
```

**Notes:**

- `principal` is derived from the bearer token, never from the body
- `server` in the request is resolved to `server_id` + stored as `server_name`
- `occurred_at` defaults to now() if not provided
- `ingested_at` is always server-set, cannot be overridden
- If `dedupe_key` matches an existing record for this principal → returns 200 with existing record
- If `server` is not found in servers or aliases → accepted with warning

#### `GET /events` — Query events

Query parameters (all optional, combined with AND):

| Param               | Type   | Example                    | Notes                      |
|---------------------|--------|----------------------------|----------------------------|
| `server`            | text   | `lintel-prod-01`           | Resolved to server_id      |
| `category`          | text   | `deployment`               | Comma-separated for multi  |
| `principal`         | text   | `claude`                   |                            |
| `tag`               | text   | `sum-platform`             | Events containing this tag |
| `since`             | ISO ts | `2026-03-01T00:00:00Z`     | occurred_at after this     |
| `until`             | ISO ts | `2026-03-02T00:00:00Z`     | occurred_at before this    |
| `since_ingested`    | ISO ts | `2026-03-01T00:00:00Z`     | ingested_at after this     |
| `until_ingested`    | ISO ts | `2026-03-02T00:00:00Z`     | ingested_at before this    |
| `issue_id`          | uuid   | `...`                      | Events linked to issue     |
| `has_correction`    | bool   | `true`                     | Filter corrected events    |
| `cursor`            | string |                            | Keyset cursor              |
| `limit`             | int    | `50`                       | Default 50, max 500        |

#### `GET /events/{id}` — Single event

Response: 200 with full event object in `data`, or 404.

### Issues

#### `POST /issues` — Open an issue

```json
// Request
{
  "title": "Tailscale connection instability on WSL2",
  "severity": "high",
  "server": "agent-workspace",
  "symptoms": "SSH connections hang during key exchange...",
  "tags": ["tailscale", "wsl2"],
  "metadata": {},
  "dedupe_key": "tailscale-wsl2-instability"
}

// Response: 201 Created
// principal derived from token, set as created_by
// status defaults to "open", version starts at 1
```

#### `GET /issues` — List issues

| Param      | Type   | Example              | Notes                     |
|------------|--------|----------------------|---------------------------|
| `status`   | text   | `open`               | Comma-separated for multi |
| `severity` | text   | `high`               |                           |
| `server`   | text   | `lintel-prod-01`     | Resolved to server_id     |
| `tag`      | text   | `tailscale`          |                           |
| `cursor`   | string |                      | Keyset cursor             |
| `limit`    | int    | `20`                 | Default 20, max 100       |

#### `GET /issues/{id}` — Full issue with timeline

Returns the issue object plus embedded `updates` array (chronological) and `related_issues` array.

#### `PATCH /issues/{id}` — Update an issue

Requires `version` field for optimistic concurrency. Returns `409 Conflict` if version mismatch.

```json
// Request
{
  "version": 1,
  "status": "investigating",
  "root_cause": "WSL2 networking quirks causing Tailscale state corruption"
}

// Response: 200 OK
// version is now 2
// An issue_update record is automatically created with:
//   - principal from auth
//   - content auto-generated from changes
//   - status_from: "open", status_to: "investigating"
//   - changes: {"status": {"from": "open", "to": "investigating"},
//               "root_cause": {"from": null, "to": "WSL2 networking..."}}
```

**Concurrency:** The API reads the current issue, checks `version` matches, applies the patch, computes the diff, increments version, and writes both the issue update and issue_update record in a single transaction. On version mismatch → 409 with the current issue state so the client can retry.

#### `POST /issues/{id}/updates` — Add an observation (no field changes)

```json
{
  "content": "Occurred again at 14:30. Restarting tailscaled resolved it in <5s.",
  "occurred_at": "2026-03-02T14:30:00Z"
}
```

This creates an `issue_update` with no `status_from`/`status_to` and empty `changes`. Also bumps `last_occurrence` on the parent issue.

#### `POST /issues/{id}/relate` — Link issues

```json
{
  "related_issue_id": "...",
  "relationship": "caused_by"
}
```

Directionality: the current issue (`{id}`) is `src`, the `related_issue_id` is `dst`. So `POST /issues/A/relate` with `caused_by` means "A was caused by B."

For `related` (symmetric), the API canonicalises to `src < dst` before insert.

### Servers

#### `GET /servers` — List known servers

#### `GET /servers/{name}/briefing` — Agent situational awareness

Resolves `name` against both `servers.name` and `server_aliases.alias_name`.

```json
// Response
{
  "data": {
    "server": {
      "id": "9f8e7d6c-...",
      "name": "lintel-prod-01",
      "display_name": "Production",
      "status": "active",
      "aliases": ["coolify"]
    },
    "recent_events": [
      // Last 48 hours, ordered by ingested_at DESC
    ],
    "open_issues": [
      // status IN ('open', 'investigating', 'watching')
    ],
    "summary": {
      "events_last_24h": 5,
      "events_last_7d": 23,
      "open_issue_count": 1,
      "last_deployment": "2026-03-01T10:00:00Z"
    }
  },
  "warnings": []
}
```

#### `PUT /servers/{name}` — Register or update a server (admin only)

```json
{
  "display_name": "Internal Tools 01",
  "private_ipv4": "10.44.0.4",
  "status": "active",
  "notes": "Formerly 'coolify'. Hosts OpsLog, Gitea, internal tools."
}
```

#### `POST /servers/{name}/aliases` — Add an alias (admin only)

```json
{
  "alias": "coolify"
}
```

#### `DELETE /servers/{name}/aliases/{alias}` — Remove an alias (admin only)

### Utility

#### `GET /categories` — List valid event categories

Returns the enum with descriptions. No auth required.

#### `GET /health` — Health check

```json
{
  "status": "ok",
  "version": "0.3.0",
  "db": "connected",
  "uptime_seconds": 86400
}
```

No auth required.

---

## Database enforcement summary

These invariants are enforced at the PostgreSQL level, not just in application code.

### Triggers

| Trigger                       | Table          | Behaviour                                    |
|-------------------------------|----------------|----------------------------------------------|
| `trg_events_immutable`        | events         | RAISE on UPDATE or DELETE                    |
| `trg_issue_updates_immutable` | issue_updates  | RAISE on UPDATE or DELETE                    |
| `trg_servers_updated_at`      | servers        | Set `updated_at = now()` on UPDATE           |
| `trg_issues_updated_at`       | issues         | Set `updated_at = now()` on UPDATE           |
| `trg_issues_version_bump`     | issues         | Set `version = version + 1` on UPDATE        |

### CHECK constraints (summary)

| Table          | Constraint                                                              |
|----------------|-------------------------------------------------------------------------|
| principals     | `role IN ('admin', 'writer', 'reader')`                                 |
| principals     | `status IN ('active', 'revoked')`                                       |
| servers        | `status IN ('active', 'decommissioned')`                                |
| events         | `category IN ('deployment','config_change','dns','service','security','backup','network','account','infra','ci','observation','other')` |
| events         | `char_length(summary) <= 1024`                                          |
| events         | `jsonb_typeof(metadata) = 'object'`                                     |
| issues         | `status IN ('open','investigating','watching','resolved','wontfix')`    |
| issues         | `severity IN ('critical','high','medium','low')`                        |
| issues         | `char_length(title) <= 512`                                             |
| issues         | `jsonb_typeof(metadata) = 'object'`                                     |
| issues         | `last_occurrence >= first_seen`                                         |
| issues         | `(status IN ('resolved','wontfix')) = (resolved_at IS NOT NULL)`        |
| issue_updates  | `jsonb_typeof(changes) = 'object'`                                      |
| related_issues | `src_issue_id <> dst_issue_id`                                          |
| related_issues | `relationship IN ('related','caused_by','duplicate_of')`                |

### DB roles

| Role           | Privileges                                                                                     |
|----------------|------------------------------------------------------------------------------------------------|
| `opslog_app`   | INSERT on events, issue_updates. INSERT/UPDATE on issues, servers, server_aliases, principals. SELECT on all. |
| `opslog_read`  | SELECT on all tables.                                                                          |

The application connects as `opslog_app`. The `opslog_app` role does NOT have DELETE on events or issue_updates, providing a second layer of immutability enforcement beyond triggers.

---

## Payload limits

| Field               | Max size    | Enforced by          |
|---------------------|-------------|----------------------|
| `summary`           | 1,024 chars | DB CHECK             |
| `title` (issues)    | 512 chars   | DB CHECK             |
| `detail`            | 200 KB      | API validation       |
| `metadata`          | 200 KB      | API validation       |
| `content` (updates) | 200 KB      | API validation       |
| `tags` array        | 50 items    | API validation       |
| Request body total  | 512 KB      | API middleware        |

---

## Agent usage patterns

### Starting a session

```bash
curl -H "Authorization: Bearer $OPSLOG_TOKEN" \
  http://10.44.0.x:8600/api/v1/servers/lintel-prod-01/briefing
```

### Logging work (with idempotency)

```bash
curl -X POST http://10.44.0.x:8600/api/v1/events \
  -H "Authorization: Bearer $OPSLOG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "server": "lintel-prod-01",
    "category": "config_change",
    "summary": "Updated Caddy config for api.lintel.digital",
    "metadata": {"file": "/etc/caddy/sites-enabled/api.lintel.digital"},
    "dedupe_key": "caddy-api-lintel-digital-20260302"
  }'
```

### Logging CI pipeline results

```bash
curl -X POST http://10.44.0.x:8600/api/v1/events \
  -H "Authorization: Bearer $OPSLOG_CI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "server": "agent-workspace",
    "category": "ci",
    "summary": "Pipeline #142 passed: sum-platform main (14/14 tests green)",
    "tags": ["sum-platform", "main", "passed"],
    "metadata": {
      "pipeline_id": 142,
      "repo": "markashton480/sum-platform",
      "branch": "main",
      "commit": "abc1234",
      "duration_seconds": 187,
      "tests_passed": 14,
      "tests_failed": 0
    },
    "dedupe_key": "pipeline-142"
  }'
```

### Reporting a problem

```bash
curl -X POST http://10.44.0.x:8600/api/v1/issues \
  -H "Authorization: Bearer $OPSLOG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Caddy failing to reload after config change",
    "severity": "high",
    "server": "lintel-prod-01",
    "symptoms": "systemctl reload caddy returns exit code 1"
  }'
```

### Updating an issue (with optimistic concurrency)

```bash
# First GET the issue to read current version
curl -H "Authorization: Bearer $OPSLOG_TOKEN" \
  http://10.44.0.x:8600/api/v1/issues/a1b2c3d4-...

# Then PATCH with version
curl -X PATCH http://10.44.0.x:8600/api/v1/issues/a1b2c3d4-... \
  -H "Authorization: Bearer $OPSLOG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 1,
    "status": "resolved",
    "solution": "Syntax error in Caddyfile — missing closing brace"
  }'
```

### Recording a correction

```bash
curl -X POST http://10.44.0.x:8600/api/v1/events \
  -H "Authorization: Bearer $OPSLOG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "server": "lintel-prod-01",
    "category": "observation",
    "summary": "Correction: event a1b2c3d4 incorrectly listed server as agent-workspace",
    "corrects_event_id": "a1b2c3d4-...",
    "tags": ["correction"]
  }'
```

---

## Operational notes

### Connection pooling

The FastAPI application should use an async connection pool (e.g. `asyncpg` pool or SQLAlchemy async with pool). If agent call volume grows, introduce PgBouncer in transaction mode between FastAPI and PostgreSQL.

### Partitioning (future, not v0.3)

The `events` table is a candidate for range partitioning by `ingested_at` (monthly). This makes retention/archival clean (`DROP PARTITION`) and keeps indexes compact. Plan the primary key as `(ingested_at, id)` from the start to make partitioning non-breaking later.

### Write transaction discipline

Every issue PATCH is a single transaction: read current → check version → apply changes → compute diff → update issue → insert issue_update → commit. No partial writes.

---

## Seed data

Based on current infrastructure (servers.yml, accounts.yml, runners.yml as of 2026-03-02):

### Servers

| name              | display_name       | private_ipv4 | status | notes                                                  |
|-------------------|--------------------|--------------|--------|--------------------------------------------------------|
| agent-workspace   | Agent Workspace    | (see note)   | active | Staging, CI runner (capacity 4), primary workspace     |
| lintel-prod-01    | Production         | (see note)   | active | Client sites, CI runner (capacity 3)                   |
| lintel-tools-01   | Internal Tools 01  | (see note)   | active | Formerly "coolify". Hosts Coolify, Gitea, internal tools |
| lintel-tools-02   | Internal Tools 02  | (see note)   | active | (details to be populated from live infrastructure)     |

**Note:** Private network IPs were present in an earlier version of servers.yml but are absent from the current version. These should be populated from the live infrastructure during seeding. The servers.yml file still lists `coolify` as the name — this is stale and should be updated separately.

### Server aliases

| server canonical name | alias       | reason                              |
|-----------------------|-------------|-------------------------------------|
| lintel-tools-01       | coolify     | Original name before rename         |

### Principals

| name       | role   |
|------------|--------|
| mark       | admin  |
| claude     | writer |
| codex_a    | writer |
| codex_b    | writer |
| codex_c    | writer |
| sum-cli    | writer |
| ci_runner  | writer |
| readonly   | reader |

---

## Dashboard

### Overview

A React/Vite/TSX single-page application that consumes the OpsLog API. Provides visual situational awareness for human operators — the "what's going on across the fleet?" view that agents get from the briefing endpoint but humans need in a browser.

### Architecture

```
lintel-opslog/
├── api/                    # FastAPI application
│   ├── ...
│   └── Dockerfile
├── dashboard/              # React SPA
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/            # API client layer
│   │   │   └── client.ts   # Typed fetch wrapper for OpsLog API
│   │   ├── components/     # Shared UI components
│   │   │   ├── Layout.tsx
│   │   │   ├── ServerCard.tsx
│   │   │   ├── EventRow.tsx
│   │   │   ├── IssueBadge.tsx
│   │   │   ├── StatusPill.tsx
│   │   │   ├── SeverityBadge.tsx
│   │   │   ├── CategoryPill.tsx
│   │   │   ├── PrincipalAvatar.tsx
│   │   │   ├── TimelineEntry.tsx
│   │   │   ├── FilterBar.tsx
│   │   │   └── Pagination.tsx
│   │   ├── pages/
│   │   │   ├── FleetOverview.tsx
│   │   │   ├── EventStream.tsx
│   │   │   ├── IssuesBoard.tsx
│   │   │   ├── IssueDetail.tsx
│   │   │   └── ServerDetail.tsx
│   │   ├── hooks/
│   │   │   ├── useEvents.ts
│   │   │   ├── useIssues.ts
│   │   │   ├── useServers.ts
│   │   │   └── useBriefing.ts
│   │   └── types/
│   │       └── opslog.ts   # TypeScript types matching API schema
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── package.json
├── README.md
└── ...
```

**Deployment:** The dashboard is built (`vite build`) into static files and served by Caddy (or any static file server) on the same host. It talks to the API over the private network.

| Property         | Value                                                |
|------------------|------------------------------------------------------|
| **Stack**        | React 19 + Vite + TypeScript + Tailwind CSS          |
| **Testing**      | Vitest                                               |
| **Routing**      | React Router (client-side)                           |
| **State**        | React Query (TanStack Query) for server state        |
| **Build output** | Static files served by Caddy                         |
| **Auth**         | Dashboard uses a `readonly` bearer token (or `mark` for admin actions), stored in a session cookie or env-injected config |
| **Port**         | TBD (suggest 8601, or served under a path on 8600)   |
| **URL**          | `http://10.44.0.x:8601` or `http://opslog.lintel.live` |

### CORS

The API needs to allow CORS from the dashboard origin. Since both are on the private network, this is a simple allowlist:

```python
# api/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://10.44.0.x:8601", "http://opslog.lintel.live"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### API client layer

A typed TypeScript client wrapping `fetch`, mapping to the OpsLog API types. All hooks use this client through TanStack Query for caching, refetching, and optimistic updates.

```typescript
// dashboard/src/api/client.ts (sketch)
const BASE_URL = import.meta.env.VITE_OPSLOG_API_URL;
const TOKEN = import.meta.env.VITE_OPSLOG_TOKEN;

async function request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  return res.json();
}
```

### Views

#### 1. Fleet Overview (`/`)

The home page. Answers: "is everything okay right now?"

**Layout:** Grid of server cards, one per registered server. Responsive — 2 columns on tablet, 3-4 on desktop.

**Each server card shows:**

- Server name + display name
- Status indicator (green dot = active, grey = decommissioned)
- Event count badge (last 24h)
- Open issue count (colour-coded: red if any critical/high, amber for medium, green for zero)
- Last event timestamp + relative time ("3h ago")
- Last deployment timestamp (if any)
- Severity heat: a subtle coloured left-border or background tint based on worst open issue severity

**Interactions:**

- Click a card → navigates to Server Detail page
- A small "issues" link/count on each card → filters Issues Board to that server

**Data source:** `GET /servers` + `GET /servers/{name}/briefing` for each server. TanStack Query handles parallel fetches. Auto-refetch every 60 seconds.

#### 2. Event Stream (`/events`)

A filterable, scrollable timeline of all events across the fleet. The replacement for reading changelog.md / git log.

**Layout:** Full-width table/list with compact rows. Most recent at top.

**Each event row shows:**

- Timestamp (occurred_at, with ingested_at on hover)
- Principal badge (small coloured avatar/chip — each principal gets a consistent colour)
- Server name (clickable → Server Detail)
- Category pill (coloured by category)
- Summary text
- Tags as small chips
- Issue link if present
- Correction indicator if `corrects_event_id` is set

**Filters (in a persistent filter bar at top):**

- Server (dropdown, multi-select)
- Category (dropdown, multi-select)
- Principal (dropdown, multi-select)
- Time range (preset buttons: last 1h, 6h, 24h, 7d, 30d + custom date picker)
- Tag (text input, autocomplete from seen tags)
- Free-text search on summary (API would need a `q` param — or client-side filter for small result sets)

**Expanded row (click to expand):**

- Full `detail` markdown rendered
- `metadata` displayed as a formatted JSON block or key-value table
- If correction: link to corrected event
- If linked to issue: issue title + status pill, clickable

**Pagination:** Infinite scroll using cursor pagination. "Load more" button at bottom as fallback.

**Data source:** `GET /events` with query params from filters. Cursor pagination via `next_cursor`.

#### 3. Issues Board (`/issues`)

The WBLT replacement. Two view modes: **kanban** (default) and **table**.

**Kanban view:**

Four columns: Open | Investigating | Watching | Resolved/Won't Fix (collapsed by default)

Each issue is a card showing:

- Title (truncated to 2 lines)
- Severity badge (red/orange/yellow/grey)
- Server name
- Created by (principal badge)
- Last updated relative time
- Last occurrence relative time
- Tag chips

Cards sorted by severity (critical first), then by last_occurrence DESC within severity.

**Table view:**

Sortable columns: Title, Status, Severity, Server, Created By, First Seen, Last Occurrence, Updated At.

Default sort: severity DESC, last_occurrence DESC.

**Filters (shared between both views):**

- Status (multi-select checkboxes, "active" preset = open + investigating + watching)
- Severity (multi-select)
- Server (dropdown)
- Tag (text input)

**Interactions:**

- Click an issue → navigates to Issue Detail page
- Kanban drag-and-drop: NOT in v1 (status changes should go through the API with concurrency control)
- "New Issue" button → opens a create form (admin/writer token required)

**Data source:** `GET /issues` with filters. Cursor pagination.

#### 4. Issue Detail (`/issues/:id`)

The full incident page for a single issue.

**Header section:**

- Title (large)
- Status pill + Severity badge
- Server name (clickable)
- Created by principal + timestamp
- Last occurrence timestamp
- Resolved at (if applicable)
- Tags
- "Edit" button → inline editing for status, severity, root_cause, solution, symptoms (submits PATCH with version)

**Body section (two columns on desktop, stacked on mobile):**

Left (wider): Timeline

- Chronological list of all `issue_updates`
- Each entry shows: timestamp, principal badge, content text, status transition arrow if applicable (e.g. "open → investigating"), structured changes diff rendered as human-readable text
- Linked events interspersed in timeline (events where `issue_id` matches), visually distinct from updates
- "Add observation" form at bottom of timeline (POST /issues/{id}/updates)

Right (narrower): Metadata panel

- Symptoms (rendered markdown)
- Root cause (rendered markdown, or "Unknown" placeholder)
- Solution (rendered markdown, or "Not yet resolved" placeholder)
- Related issues (links, with relationship labels)
- Linked events count
- Metadata JSON (collapsible)

**Data source:** `GET /issues/{id}` (includes updates + related issues). `GET /events?issue_id={id}` for linked events.

#### 5. Server Detail (`/servers/:name`)

Visual version of the briefing endpoint.

**Header:**

- Server name + display name
- Status indicator
- Aliases listed (with a "formerly known as" style)
- Private IPv4
- Notes

**Summary strip (horizontal stats bar):**

- Events last 24h / 7d
- Open issues count (severity breakdown)
- Last deployment (relative time)
- Last event (relative time)

**Two panels below:**

**Recent Events panel:** Same as Event Stream but pre-filtered to this server. Last 48h by default, expandable. Compact rows.

**Open Issues panel:** Same as Issues Board table view but pre-filtered to this server. Only active statuses shown.

**Data source:** `GET /servers/{name}/briefing` for the summary data. Same event/issue query endpoints for the panels.

### Shared components

| Component          | Purpose                                                    |
|--------------------|------------------------------------------------------------|
| `Layout`           | Shell: sidebar nav + header + main content area            |
| `ServerCard`       | Fleet overview card for one server                         |
| `EventRow`         | Compact event display for stream and server detail         |
| `IssueBadge`       | Compact issue card for kanban and server detail            |
| `StatusPill`       | Coloured pill for issue status                             |
| `SeverityBadge`    | Coloured badge for issue severity                          |
| `CategoryPill`     | Coloured pill for event category                           |
| `PrincipalAvatar`  | Consistent colour-coded badge for each principal           |
| `TimelineEntry`    | Single entry in the issue detail timeline                  |
| `FilterBar`        | Reusable filter controls for events and issues             |
| `Pagination`       | Cursor-based "load more" / infinite scroll                 |

### Colour system

Consistent colour language across all views:

**Severity:**

- Critical: red-500
- High: orange-500
- Medium: yellow-500
- Low: slate-400

**Issue status:**

- Open: red-500
- Investigating: orange-500
- Watching: yellow-500
- Resolved: green-500
- Won't Fix: slate-400

**Event categories:**

- deployment: blue-500
- config_change: violet-500
- dns: cyan-500
- service: amber-500
- security: red-500
- backup: emerald-500
- network: teal-500
- account: pink-500
- infra: indigo-500
- ci: sky-500
- observation: slate-400
- other: slate-300

**Principals:** Each principal gets a stable hue derived from their name (simple hash → hue), displayed as a small coloured circle or chip with initials.

### Auto-refresh

All views auto-refresh on an interval using TanStack Query's `refetchInterval`:

- Fleet Overview: every 60s
- Event Stream: every 30s (with "new events available" toast rather than jarring re-render)
- Issues Board: every 60s
- Issue Detail: every 30s
- Server Detail: every 30s

### Navigation

Sidebar with:

- **Fleet** (home/overview)
- **Events** (stream)
- **Issues** (board)
- Divider
- **Servers** section: list of server names as sub-links, each going to Server Detail

Top header: OpsLog branding/title, maybe a global search input (future).

---

## Future considerations (not in v0.3)

- **Webhooks / notifications** — POST to a Slack/Discord/email endpoint on critical events or issue status changes
- **Retention policy** — auto-archive events older than N months via partition drops
- **YAML sync** — periodic job that reconciles OpsLog state with the lintel-ops YAML files
- **Agent SDK** — tiny Python wrapper so agents don't construct curl; handles auth, idempotency, retries
- **Alias reconciliation** — background job to retroactively set `server_id` on orphaned events when a new alias is created
- **mTLS upgrade** — if the network perimeter expands, upgrade from bearer tokens to mutual TLS
- **CI integration** — Gitea webhook or Act runner post-job hook to auto-log pipeline results to OpsLog
- **Dashboard: real-time streaming** — WebSocket or SSE feed from the API for live event updates instead of polling
- **Dashboard: global search** — full-text search across event summaries, issue titles, and update content
- **Dashboard: kanban drag-and-drop** — issue status changes via drag with optimistic concurrency handling
- **Dashboard: dark mode** — respect system preference

---

## Open items

- [ ] Confirm which server hosts this (lintel-tools-01 vs lintel-tools-02)
- [ ] Assign private network IP and port
- [ ] Decide on systemd service name (suggest: `opslog`)
- [ ] Generate initial bearer tokens for each principal
- [ ] Seed initial servers from current infrastructure (populate private_ipv4 from live state)
- [ ] Add `coolify` as alias for lintel-tools-01 during initial seed
- [ ] Populate lintel-tools-02 details (specs, purpose, IP) from live infrastructure
- [ ] Backfill existing changelog.md entries as historical events (optional)
- [ ] Backfill existing WBLT items as issues (optional)
- [ ] Set up Gitea webhook or Act runner post-job hook for automatic `ci` events
- [ ] Decide dashboard serving: separate port (8601) vs Caddy sub-path vs subdomain (opslog.lintel.live)
- [ ] Add CORS config to API for dashboard origin
- [ ] Choose dashboard auth approach: env-injected readonly token vs login form