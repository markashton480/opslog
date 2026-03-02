# Lintel OpsLog — Implementation Plan

**Date:** 2026-03-02  
**Design spec:** lintel-opslog-design-v0.3  
**Target:** Working system (API + dashboard + deployment) ready for production use

---

## Repo structure

```
lintel-opslog/
├── api/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI app, lifespan, CORS, middleware
│   │   ├── config.py                # Settings via pydantic-settings (env vars)
│   │   ├── db.py                    # asyncpg pool setup
│   │   ├── auth.py                  # Bearer token resolution → principal
│   │   ├── models.py                # Pydantic request/response models
│   │   ├── enums.py                 # Category, status, severity, role enums
│   │   ├── pagination.py            # Cursor encode/decode helpers
│   │   ├── middleware.py             # Request size limit, timing, warnings
│   │   ├── exceptions.py            # Custom exception handlers
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── events.py
│   │       ├── issues.py
│   │       ├── servers.py
│   │       └── utility.py           # /health, /categories
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_triggers.sql
│   │   ├── 003_indexes.sql
│   │   ├── 004_roles.sql
│   │   └── 005_seed.sql
│   ├── tests/
│   │   ├── conftest.py              # Fixtures: test DB, test client, auth tokens
│   │   ├── test_events.py
│   │   ├── test_issues.py
│   │   ├── test_servers.py
│   │   ├── test_auth.py
│   │   ├── test_pagination.py
│   │   └── test_idempotency.py
│   ├── scripts/
│   │   ├── generate_tokens.py       # One-off: generate bearer tokens for principals
│   │   ├── migrate.py               # Run migrations in order
│   │   └── seed.py                  # Seed servers + principals from YAML/config
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── README.md
├── dashboard/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   └── types.ts             # Generated/maintained from API schema
│   │   ├── components/
│   │   │   └── ...                   # As per design spec
│   │   ├── pages/
│   │   │   └── ...                   # As per design spec
│   │   └── hooks/
│   │       └── ...
│   ├── tests/
│   │   ├── setup.ts
│   │   ├── components/
│   │   └── pages/
│   ├── index.html
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── package.json
│   ├── Dockerfile                    # Multi-stage: build → nginx/caddy static
│   └── README.md
├── docker-compose.yml                # Full local stack: postgres + api + dashboard
├── docker-compose.dev.yml            # Dev overrides: hot reload, exposed ports
├── .env.example                      # Template for all env vars
├── .gitignore
├── Makefile                          # DX shortcuts
└── README.md                         # Top-level: architecture, quickstart, deployment
```

---

## Milestones

### Milestone 0: Project scaffolding & DX setup

**Goal:** Anyone (human or agent) can `git clone` → `make dev` → working local stack with hot reload in under 2 minutes.

**Tasks:**

0.1. **Initialise repo structure**
- Create directory skeleton as above
- `.gitignore` (Python, Node, Docker, IDE)
- Top-level `README.md` with architecture overview

0.2. **Python project setup (`api/`)**
- `pyproject.toml` with dependencies:
  - Runtime: `fastapi`, `uvicorn[standard]`, `asyncpg`, `pydantic`, `pydantic-settings`
  - Dev: `pytest`, `pytest-asyncio`, `httpx` (async test client), `ruff` (lint/format), `mypy`
- Minimal `app/main.py` that starts and returns `{"status": "ok"}` on `/api/v1/health`
- `app/config.py` with pydantic-settings loading from env vars (DB URL, API port, etc.)

0.3. **Dashboard project setup (`dashboard/`)**
- `npm create vite@latest` with React + TypeScript template
- Install core deps: `react@19.2.0`, `react-dom@19.2.0`, `react-router`, `@tanstack/react-query`, `tailwindcss`, `@tailwindcss/vite`
- Install dev deps: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`
- Configure Tailwind, Vitest, tsconfig paths
- Minimal `App.tsx` that renders "OpsLog Dashboard" with Tailwind styling
- Vite proxy config: `/api/*` → `http://localhost:8600` for local dev

0.4. **Docker setup**
- `api/Dockerfile`: Python 3.12 slim, install deps, run uvicorn
- `dashboard/Dockerfile`: multi-stage — Node build → Caddy static serve
- `docker-compose.yml`:
  - `postgres` (16-alpine, volume for data, init scripts mounted)
  - `api` (depends on postgres, env vars for DB connection)
  - `dashboard` (depends on api)
  - Internal network, exposed ports for local access
- `docker-compose.dev.yml` (overrides):
  - API: mount source code, run with `--reload`
  - Dashboard: mount source, run `vite dev` instead of built static
  - Postgres: exposed port for direct access (psql)

0.5. **Makefile / DX shortcuts**
```makefile
dev:            docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
down:           docker compose down -v
test-api:       cd api && pytest
test-dash:      cd dashboard && npm test
test:           make test-api && make test-dash
lint:           cd api && ruff check . && cd ../dashboard && npm run lint
format:         cd api && ruff format . && cd ../dashboard && npm run format
migrate:        docker compose exec api python scripts/migrate.py
seed:           docker compose exec api python scripts/seed.py
tokens:         docker compose exec api python scripts/generate_tokens.py
logs:           docker compose logs -f api
psql:           docker compose exec postgres psql -U opslog -d opslog
```

0.6. **CI-ready structure** (actual CI pipeline is separate, but structure supports it)
- `api/tests/conftest.py` with fixtures for test database (separate DB, transactions rolled back)
- `dashboard/vitest.config.ts` ready to run

**Exit criteria:** `make dev` brings up Postgres + API (health endpoint works) + Dashboard (renders placeholder page). `make test` runs both test suites (trivial passing tests). `make psql` connects to the database.

---

### Milestone 1: Database schema & migrations

**Goal:** Full schema deployed, all constraints and triggers enforced, seed data loaded.

**Tasks:**

1.1. **Migration 001: initial schema**
- `principals` table
- `servers` table
- `server_aliases` table
- `events` table
- `issues` table
- `issue_updates` table
- `related_issues` table
- All CHECK constraints as per design spec
- All foreign keys

1.2. **Migration 002: triggers**
- `trg_events_immutable` — RAISE on UPDATE/DELETE
- `trg_issue_updates_immutable` — RAISE on UPDATE/DELETE
- `trg_servers_updated_at` — auto-bump updated_at
- `trg_issues_updated_at` — auto-bump updated_at
- `trg_issues_version_bump` — increment version on UPDATE

1.3. **Migration 003: indexes**
- All indexes from design spec (composite, partial, GIN)
- Test that index-only scans work for the briefing query pattern

1.4. **Migration 004: roles**
- Create `opslog_app` role with INSERT on events/issue_updates, INSERT/UPDATE on issues/servers/server_aliases/principals, SELECT on all
- Create `opslog_read` role with SELECT on all
- Verify `opslog_app` cannot DELETE from events or issue_updates

1.5. **Migration 005: seed data**
- Insert servers: agent-workspace, lintel-prod-01, lintel-tools-01, lintel-tools-02
- Insert alias: coolify → lintel-tools-01
- Insert principals: mark (admin), claude (writer), codex_a/b/c (writer), sum-cli (writer), ci_runner (writer), readonly (reader)
- Token hashes generated via `scripts/generate_tokens.py`

1.6. **Migration runner script**
- `scripts/migrate.py`: reads SQL files in order, tracks applied migrations in a `_migrations` table, idempotent

1.7. **Tests**
- Trigger tests: verify events cannot be updated/deleted, issues version auto-increments, updated_at auto-bumps
- Constraint tests: invalid category rejected, resolved_at consistency enforced, duplicate dedupe_key rejected
- Role tests: opslog_app can insert events but not delete them

**Exit criteria:** `make migrate && make seed` creates the full schema. `make psql` lets you inspect all tables, triggers, and constraints. All migration tests pass.

---

### Milestone 2: API core — auth, events, health

**Goal:** Events can be written and queried. Auth works. The foundational API patterns are established.

**Tasks:**

2.1. **Database connection layer**
- `app/db.py`: asyncpg pool, lifespan startup/shutdown, connection context manager
- Health endpoint queries `SELECT 1` to verify DB connectivity

2.2. **Auth middleware**
- `app/auth.py`: extract `Authorization: Bearer <token>` → hash → look up in principals → inject `principal` and `role` into request state
- Return 401 for missing/invalid token, 403 for insufficient role
- Exempt `/api/v1/health` and `/api/v1/categories` from auth
- Update `last_seen_at` on each authenticated request (fire-and-forget, non-blocking)

2.3. **Response envelope & warnings**
- Middleware or dependency that collects warnings during request processing
- All responses wrapped in `{"data": ..., "warnings": [...]}` (or `{"data": [...], "next_cursor": ..., "has_more": ..., "warnings": [...]}` for lists)

2.4. **Request size limiting middleware**
- Reject request bodies > 512 KB with 413

2.5. **Event routes**
- `POST /events`: validate category (enum), resolve server name → server_id (soft validation with warning), derive principal from auth, handle dedupe_key (return existing on conflict), validate payload sizes, insert, return 201
- `GET /events`: all query params from spec, cursor pagination (encode/decode `ingested_at + id`), offset fallback
- `GET /events/{id}`: single event by UUID, 404 if not found

2.6. **Utility routes**
- `GET /health`: DB check, version, uptime
- `GET /categories`: return enum with descriptions

2.7. **Pydantic models**
- Request models: `EventCreate`, with field validation (summary max length, metadata type check, etc.)
- Response models: `EventResponse`, `EventListResponse`, `HealthResponse`, `CategoriesResponse`

2.8. **Tests**
- Auth: valid token works, invalid rejected, revoked rejected, role-based access
- Event CRUD: create event, query with each filter, pagination (cursor and offset), single event retrieval
- Idempotency: same dedupe_key returns existing record
- Soft server validation: unknown server accepted with warning in response
- Payload limits: oversized summary rejected (422), oversized body rejected (413)
- Immutability: verify no UPDATE/DELETE endpoint exists; direct DB attempt blocked by trigger

**Exit criteria:** Can create events via curl with auth, query them with filters and pagination, get warnings for unknown servers. All tests pass.

---

### Milestone 3: API — issues, updates, servers

**Goal:** Full API surface complete. Issues lifecycle, updates, server management, briefings all working.

**Tasks:**

3.1. **Issue routes**
- `POST /issues`: validate status/severity enums, resolve server, derive created_by from auth, dedupe_key, insert, return 201
- `GET /issues`: all query params, cursor pagination
- `GET /issues/{id}`: full issue + embedded updates (chronological) + related issues
- `PATCH /issues/{id}`: optimistic concurrency — require `version`, 409 on mismatch. In single transaction: read current → validate version → apply patch → compute diff → update issue → insert issue_update with changes JSONB → commit. Validate lifecycle transitions. Auto-set resolved_at when transitioning to resolved/wontfix. Auto-clear resolved_at when reopening.

3.2. **Issue update routes**
- `POST /issues/{id}/updates`: create observation (no field changes). Bump `last_occurrence` on parent issue.

3.3. **Related issues route**
- `POST /issues/{id}/relate`: validate relationship type, enforce symmetry canonical ordering for `related`, enforce single-duplicate rule for `duplicate_of`

3.4. **Server routes**
- `GET /servers`: list all servers with aliases
- `GET /servers/{name}/briefing`: resolve name (check canonical + aliases), fetch last 48h events, fetch open issues, compute summary stats (events_last_24h, events_last_7d, open_issue_count, last_deployment). Use the composite indexes.
- `PUT /servers/{name}`: admin only. Upsert server. Validate inet for private_ipv4.
- `POST /servers/{name}/aliases`: admin only. Add alias. Reject if alias conflicts with any server name or existing alias.
- `DELETE /servers/{name}/aliases/{alias}`: admin only. Remove alias.

3.5. **Pydantic models**
- `IssueCreate`, `IssuePatch` (with version field), `IssueResponse`, `IssueDetailResponse`
- `IssueUpdateCreate`, `IssueUpdateResponse`
- `RelateRequest`
- `ServerResponse`, `BriefingResponse`, `ServerUpsert`, `AliasCreate`

3.6. **Tests**
- Issue lifecycle: create → investigate → watch → resolve. Verify resolved_at set/cleared.
- Optimistic concurrency: concurrent PATCH with stale version returns 409
- Structured diffs: verify changes JSONB correctly records field-level diffs
- Issue updates: add observation, verify last_occurrence bumped
- Related issues: create all three relationship types, verify canonical ordering for `related`, verify duplicate_of uniqueness
- Briefing: create several events and issues, verify briefing response is correct and uses the right time windows
- Server aliases: create alias, verify event resolution uses alias, verify briefing works via alias name
- Admin-only: writer cannot PUT servers or manage aliases (403)

**Exit criteria:** Full API surface works end-to-end. All issue lifecycle scenarios tested. Briefing returns correct data. Admin vs writer permissions enforced.

---

### Milestone 4: Dashboard — scaffolding, API client, layout

**Goal:** Dashboard shell is running with routing, auth, API connectivity, and the shared component library. No real data views yet, but the skeleton is navigable.

**Tasks:**

4.1. **API client layer**
- `api/client.ts`: typed fetch wrapper with auth header injection, error handling, response envelope unwrapping
- `api/types.ts`: TypeScript types mirroring the Pydantic response models (Event, Issue, IssueUpdate, Server, Briefing, etc.)
- Environment config: `VITE_OPSLOG_API_URL`, `VITE_OPSLOG_TOKEN`

4.2. **TanStack Query setup**
- QueryClient with sensible defaults (staleTime, refetchInterval)
- Custom hooks: `useEvents`, `useEvent`, `useIssues`, `useIssue`, `useServers`, `useBriefing`, `useCategories`
- Each hook handles pagination (cursor), filtering, and auto-refetch

4.3. **Routing**
- React Router setup:
  - `/` → FleetOverview
  - `/events` → EventStream
  - `/issues` → IssuesBoard
  - `/issues/:id` → IssueDetail
  - `/servers/:name` → ServerDetail

4.4. **Layout shell**
- Sidebar navigation (servers listed dynamically from API)
- Header bar
- Main content area with outlet
- Responsive: sidebar collapses to hamburger on mobile

4.5. **Shared components (visual, with mock/static data)**
- `StatusPill`, `SeverityBadge`, `CategoryPill`, `PrincipalAvatar` — all with the colour system from spec
- `FilterBar` — reusable filter controls (dropdowns, date range, text input)
- `Pagination` — "Load more" button component
- Storybook-style: each component tested in isolation with Vitest + Testing Library

4.6. **Placeholder pages**
- Each page renders its title + "Loading..." with a connected query hook (proves API connectivity)

4.7. **Tests**
- Component tests: each shared component renders correctly with various props
- Routing: navigation between pages works
- API client: mock fetch, verify correct headers/params/error handling

**Exit criteria:** Dashboard runs, sidebar shows real server list from API, clicking nav links routes to placeholder pages, all component tests pass.

---

### Milestone 5: Dashboard — Fleet Overview & Server Detail

**Goal:** The two "at a glance" views are fully functional.

**Tasks:**

5.1. **ServerCard component**
- Displays: name, display name, status dot, event count (24h), open issue count with severity colouring, last event time (relative), last deployment time
- Click → navigate to server detail
- Colour-coded left border based on worst open issue severity

5.2. **Fleet Overview page**
- Responsive grid of ServerCards
- Data from parallel `useBriefing` calls (one per server)
- Loading skeletons while briefings load
- Auto-refresh every 60s
- Empty state if no servers registered

5.3. **Server Detail page**
- Header: server name, display name, status, aliases, private_ipv4, notes
- Summary stats strip: events 24h/7d, open issues (severity breakdown), last deployment, last event
- Recent Events panel: compact EventRow list, last 48h, "show more" to expand
- Open Issues panel: compact issue cards, active statuses only
- Data from `useBriefing` + `useEvents` (server-filtered) + `useIssues` (server-filtered)

5.4. **EventRow component**
- Compact row: timestamp, principal avatar, server name, category pill, summary, tags
- Expandable: click to show detail, metadata, correction link, issue link

5.5. **Tests**
- Fleet Overview: renders correct number of server cards, shows loading state, handles empty state
- Server Detail: renders briefing data, events panel, issues panel
- ServerCard: colour coding matches severity, click navigates
- EventRow: expand/collapse works, all fields render

**Exit criteria:** Fleet Overview shows all servers with live data. Clicking a server shows full detail page with events and issues. Auto-refresh working.

---

### Milestone 6: Dashboard — Event Stream

**Goal:** Full filterable, paginated event timeline.

**Tasks:**

6.1. **Event Stream page**
- Full-width event list using EventRow components
- FilterBar integration: server, category, principal, time range, tag filters
- URL query params sync (filters persist in URL for shareability)
- Cursor-based infinite scroll / "Load more" button
- "New events available" toast on refetch (don't re-render the list jarringly)

6.2. **Event detail expansion**
- Expanded view: rendered markdown for `detail`, formatted metadata JSON, correction indicator, issue link

6.3. **Time range picker**
- Preset buttons: 1h, 6h, 24h, 7d, 30d
- Custom date range picker

6.4. **Tests**
- Filters: each filter correctly updates query params and refetches
- Pagination: "load more" appends events, cursor advances
- URL sync: filters round-trip through URL
- Empty state: no events matching filters

**Exit criteria:** Can browse and filter the full event history. Pagination works smoothly. Filters are URL-persistent.

---

### Milestone 7: Dashboard — Issues Board & Issue Detail

**Goal:** Full issue management UI — browse, inspect, update.

**Tasks:**

7.1. **Issues Board page — Kanban view**
- Four columns: Open, Investigating, Watching, Resolved/Won't Fix (collapsed)
- Issue cards: title, severity badge, server, principal, last occurrence, tags
- Sorted by severity then last_occurrence within each column
- FilterBar: status (preset "active"), severity, server, tag

7.2. **Issues Board page — Table view**
- Toggle between kanban and table
- Sortable columns: title, status, severity, server, created by, first seen, last occurrence
- Same filters as kanban

7.3. **Issue Detail page**
- Header: title, status pill, severity badge, server, created by, timestamps, tags
- Edit button → inline edit mode for status, severity, root_cause, solution, symptoms
- Edit submits PATCH with version, handles 409 (refetch and prompt retry)
- Timeline: chronological issue_updates + linked events interspersed
  - Each update: timestamp, principal, content, status transition arrow, changes diff
  - Linked events visually distinct (different background/border)
- Metadata panel: symptoms, root cause, solution, related issues, metadata JSON
- "Add observation" form at bottom of timeline
- Related issues section with relationship labels, clickable links

7.4. **TimelineEntry component**
- Handles both issue updates and linked events
- Renders structured diffs as human-readable text ("Status changed from open to investigating")
- Renders markdown content

7.5. **Tests**
- Kanban: correct columns, cards in right columns, sorting
- Table: sorting works, toggle preserves filters
- Issue Detail: timeline renders in order, edit flow with optimistic concurrency, add observation
- 409 handling: shows conflict message, refetches current state

**Exit criteria:** Can browse all issues in kanban or table view. Can inspect full issue timeline. Can update issue status and add observations through the UI. Concurrency conflicts handled gracefully.

---

### Milestone 8: Containerisation & deployment readiness

**Goal:** Production-ready Docker images, deployment configuration, documentation.

**Tasks:**

8.1. **API Dockerfile (production)**
- Python 3.12 slim base
- Multi-stage: build deps → runtime image
- Non-root user
- Health check: `CMD curl -f http://localhost:8600/api/v1/health`
- Entrypoint runs migrations then starts uvicorn

8.2. **Dashboard Dockerfile (production)**
- Multi-stage: Node 22 build → Caddy static serve
- Build-time env injection for API URL
- Caddy config: SPA fallback (all routes → index.html), gzip, cache headers for static assets

8.3. **docker-compose.yml (production)**
- Postgres 16 with:
  - Named volume for data persistence
  - Custom `postgresql.conf` tuning (shared_buffers, work_mem for the workload)
  - Init script to create opslog database + roles
- API service:
  - Depends on postgres (with healthcheck wait)
  - Environment variables from `.env` file
  - Restart policy: unless-stopped
  - Resource limits (memory)
- Dashboard service:
  - Depends on API
  - Restart policy: unless-stopped

8.4. **Caddy reverse proxy config (for the host)**
- API: `opslog-api.lintel.live` or internal path → port 8600
- Dashboard: `opslog.lintel.live` → port 8601
- Or: single domain with `/api/v1/*` → API, `/` → dashboard

8.5. **systemd integration**
- `opslog.service` unit file that runs `docker compose up`
- `ExecStartPre` to pull latest images (if using a registry) or build
- Logging to journald
- Auto-restart on failure

8.6. **Deployment documentation**
- `README.md`: quickstart, architecture, deployment steps
- `.env.example` with all variables documented
- Runbook: how to generate tokens, add a new principal, add a server, rotate a token

8.7. **Security hardening**
- API listens on private network only (bind to 10.44.0.x, not 0.0.0.0)
- Postgres listens on localhost only (within Docker network)
- Dashboard served with appropriate CSP headers
- No secrets in Docker images — all via env vars

8.8. **Tests**
- Docker build succeeds for both images
- `docker compose up` brings up full stack, health check passes
- API is reachable from dashboard container
- Postgres data persists across restarts

**Exit criteria:** `docker compose up` on the target server brings up the full stack. Dashboard accessible at the configured URL. API accessible on the private network. Data persists across restarts. systemd manages the lifecycle.

---

### Milestone 9: Integration testing & polish

**Goal:** End-to-end confidence. Everything works together under realistic conditions.

**Tasks:**

9.1. **End-to-end API tests**
- Full workflow: create server → create event → create issue → add updates → resolve issue → query briefing → verify everything appears correctly
- Multi-principal: different tokens writing events, verify principal attribution
- Correction flow: create event → create correction event → verify linkage
- CI event flow: log pipeline result with structured metadata

9.2. **End-to-end dashboard tests**
- Playwright or similar: navigate each view, verify data from API appears, interact with filters, create an observation via the UI

9.3. **Load/smoke testing**
- Script that generates N events and M issues across all servers
- Verify briefing endpoint responds in < 200ms with realistic data volume
- Verify pagination handles 10k+ events gracefully

9.4. **Agent integration dry-run**
- Write a sample shell script / Python snippet simulating an agent session:
  1. Get briefing
  2. Do some "work"
  3. Log events
  4. Report an issue
  5. Update the issue
- Verify the full loop works from agent-workspace via private network

9.5. **Documentation polish**
- Agent usage guide: copy-pasteable examples for common operations
- Dashboard user guide: screenshots, what each view shows
- API reference: auto-generated from OpenAPI (FastAPI gives this for free at `/docs`)

9.6. **Bug fixes and polish from testing**

**Exit criteria:** All tests pass. Agent dry-run succeeds from agent-workspace. Dashboard is usable and shows real data. Documentation is complete enough for agents and humans to use the system.

---

## Dependency graph

```
M0 (scaffolding)
 ├── M1 (database)
 │    └── M2 (API: auth + events)
 │         └── M3 (API: issues + servers + briefing)
 │              ├── M4 (dashboard: shell + components)
 │              │    ├── M5 (dashboard: fleet + server detail)
 │              │    ├── M6 (dashboard: event stream)
 │              │    └── M7 (dashboard: issues board + detail)
 │              └── M8 (containerisation + deployment)
 └────────────────── M9 (integration testing + polish)
```

Milestones 5, 6, and 7 can run in parallel once M4 is done.  
Milestone 8 can start alongside M4-M7 (Docker setup is independent of dashboard features).  
Milestone 9 requires everything else complete.

---

## Tech stack summary

### API

| Tool              | Version    | Purpose                          |
|-------------------|------------|----------------------------------|
| Python            | 3.12+      | Runtime                          |
| FastAPI           | latest     | Web framework                    |
| Uvicorn           | latest     | ASGI server                      |
| asyncpg           | latest     | Async Postgres driver            |
| Pydantic          | v2         | Validation + serialisation       |
| pydantic-settings | latest     | Env-based configuration          |
| pytest            | latest     | Test framework                   |
| pytest-asyncio    | latest     | Async test support               |
| httpx             | latest     | Async test client                |
| ruff              | latest     | Linting + formatting             |
| mypy              | latest     | Type checking                    |

### Dashboard

| Tool                  | Version    | Purpose                      |
|-----------------------|------------|------------------------------|
| React                 | 19.2.0     | UI framework                 |
| Vite                  | latest     | Build tool + dev server      |
| TypeScript            | 5.x        | Type safety                  |
| Tailwind CSS          | 4.x        | Styling                      |
| React Router          | 7.x        | Client-side routing          |
| TanStack Query        | 5.x        | Server state management      |
| Vitest                | latest     | Test framework               |
| Testing Library       | latest     | Component testing            |

### Infrastructure

| Tool              | Version    | Purpose                          |
|-------------------|------------|----------------------------------|
| PostgreSQL        | 16         | Database                         |
| Docker            | latest     | Containerisation                 |
| Docker Compose    | v2         | Multi-container orchestration    |
| Caddy             | latest     | Static file serving + reverse proxy |
| systemd           | —          | Service management               |

---

## Estimated effort

Rough sizing — will vary based on how much is built by agents vs humans:

| Milestone | Description                          | Effort estimate |
|-----------|--------------------------------------|-----------------|
| M0        | Scaffolding & DX                     | Small           |
| M1        | Database schema & migrations         | Small           |
| M2        | API: auth + events + health          | Medium          |
| M3        | API: issues + servers + briefing     | Medium-Large    |
| M4        | Dashboard: shell + components        | Medium          |
| M5        | Dashboard: fleet + server detail     | Medium          |
| M6        | Dashboard: event stream              | Medium          |
| M7        | Dashboard: issues board + detail     | Medium-Large    |
| M8        | Containerisation + deployment        | Medium          |
| M9        | Integration testing + polish         | Medium          |

The API (M0-M3) is the critical path. Dashboard work (M4-M7) has no blockers once M3 is complete and can be parallelised across multiple agents.