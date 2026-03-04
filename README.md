# Lintel OpsLog

A centralised, write-optimised event log and issue tracker for the Lintel infrastructure. Designed to be consumed and written to by AI agents (Claude Code, Codex A/B/C) and human operators via a simple REST API.

## Architecture

```
                        ┌─────────────────────────────────┐
                        │      opslog.lintel.digital       │
                        │         (Host Caddy/TLS)         │
                        └──────────────┬──────────────────┘
                                       │
                        ┌──────────────▼──────────────────┐
                        │  Dashboard Caddy (:8601)         │
                        │  ┌────────────┬────────────┐     │
                        │  │ /api/v1/*  │    /*      │     │
                        │  │ proxy→api  │ static SPA │     │
                        │  └─────┬──────┴────────────┘     │
                        └────────┼────────────────────────┘
                  ┌──────────────▼──────────────────┐
                  │   API (FastAPI :8600)            │
                  │   • Bearer token + OIDC auth     │
                  │   • Auto-migrations on start     │
                  └──────────────┬──────────────────┘
                  ┌──────────────▼──────────────────┐
                  │   PostgreSQL 16                   │
                  │   • Custom tuning                │
                  │   • Named volume persistence     │
                  └─────────────────────────────────┘
```

```
opslog/
├── api/                    # FastAPI application
│   ├── app/                # Python package (routes, auth, models, db)
│   ├── migrations/         # SQL migration files
│   ├── scripts/            # migrate.py, seed.py, generate_tokens.py
│   ├── entrypoint.sh       # Runs migrations then starts uvicorn
│   └── Dockerfile          # Multi-stage production image
├── dashboard/              # React SPA
│   ├── src/                # Components, pages, hooks, API client
│   ├── tests/              # Vitest unit test suites
│   ├── e2e/                # Playwright E2E tests
│   ├── Caddyfile           # Static serving + API reverse proxy
│   └── Dockerfile          # Multi-stage: build → Caddy serve
├── deploy/                 # Deployment configuration
│   ├── Caddyfile           # Host-level reverse proxy (TLS)
│   ├── opslog.service      # systemd unit file
│   ├── opslog-deploy.service  # Auto-deploy systemd service
│   ├── opslog-deploy.timer    # 2-minute poll timer
│   ├── auto-deploy.sh      # Pull-and-redeploy script
│   └── postgres/           # DB tuning + init script
├── .github/
│   └── workflows/
│       └── ci.yml          # PR/push CI pipeline
├── docs/
│   ├── spec.md             # Design specification
│   ├── implementation.md   # Implementation plan
│   ├── runbook.md          # Operations runbook
│   ├── agent-guide.md      # Agent usage guide (copy-paste examples)
│   └── dashboard-guide.md  # Dashboard user guide
├── docker-compose.yml      # Production stack
├── docker-compose.dev.yml  # Development overrides
├── Makefile                # Build/test/deploy commands
└── .env.example            # Environment variable template
```

## Quickstart (Development)

```bash
# 1. Copy env template
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD (e.g. "opslog" for local dev)

# 2. Start local stack with hot-reload
make dev

# 3. Run tests
make test

# 4. View API logs
make logs

# 5. Connect to database
make psql

# 6. Stop and clean up
make down
```

Dashboard: http://localhost:8601  
API (via proxy): http://localhost:8601/api/v1/health

## Production Deployment

```bash
# Build production images
make build

# Start production stack
make up

# Generate auth tokens
make tokens
```

Target host: `lintel-tools-02`  
URL: `https://opslog.lintel.digital`  
API: `https://opslog.lintel.digital/api/v1`

Dashboard auth:
- Production: Keycloak OIDC (`VITE_AUTH_MODE=oidc`)
- Dev fallback: static token mode (`VITE_AUTH_MODE=token`)

See [docs/runbook.md](./docs/runbook.md) for the full operations runbook including first-time setup, principal management, and troubleshooting.

## CI/CD

**CI** — GitHub Actions runs on every PR and push to `main`:
- Dashboard: typecheck → test → build
- API: lint → test (with PostgreSQL service)
- Docker: build both images
- E2E: Playwright tests against full Docker stack

**CD** — Automatic deployment via systemd timer on `lintel-tools-02`:
- `opslog-deploy.timer` polls `origin/main` every 2 minutes
- If new commits are detected, pulls, rebuilds images, and restarts containers
- Health check verifies the deploy succeeded
- Logs to journald: `journalctl -u opslog-deploy -f`

## Tech Stack

- **API**: Python 3.12 + FastAPI + asyncpg + PostgreSQL 16
- **Dashboard**: React 19 + Vite + TypeScript + Tailwind CSS 4
- **Serving**: Caddy (static files + reverse proxy + TLS)
- **Infrastructure**: Docker Compose + systemd
- **CI/CD**: GitHub Actions (CI) + systemd timer auto-deploy (CD)

## Testing

```bash
# Unit tests (API + Dashboard)
make test

# API tests only
make test-api

# Dashboard unit tests only
make test-dash

# Playwright E2E tests (requires running stack)
make dev
cd dashboard && npm run test:e2e

# Smoke/load test
./tests/smoke_test.sh

# Agent integration dry-run
./tests/agent_dryrun.sh
```

## Design Docs

- [Design Specification](./docs/spec.md)
- [Implementation Plan](./docs/implementation.md)
- [Operations Runbook](./docs/runbook.md)
- [Agent Usage Guide](./docs/agent-guide.md)
- [Dashboard User Guide](./docs/dashboard-guide.md)
