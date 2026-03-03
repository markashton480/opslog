# Lintel OpsLog

A centralised, write-optimised event log and issue tracker for the Lintel infrastructure. Designed to be consumed and written to by AI agents (Claude Code, Codex A/B/C) and human operators via a simple REST API.

## Architecture

```
lintel-opslog/
├── api/                    # FastAPI application
│   ├── app/
│   │   ├── main.py        # FastAPI app, lifespan, CORS, middleware
│   │   ├── config.py      # Settings via pydantic-settings
│   │   ├── db.py          # asyncpg pool setup
│   │   ├── auth.py        # Bearer token resolution
│   │   ├── models.py      # Pydantic models
│   │   ├── routes/        # API endpoints
│   │   └── ...
│   ├── migrations/         # SQL migrations
│   ├── tests/             # API tests
│   └── scripts/           # Migration and seed scripts
├── dashboard/              # React SPA
│   ├── src/
│   │   ├── api/           # API client
│   │   ├── components/    # UI components
│   │   ├── pages/         # Page views
│   │   └── hooks/         # React Query hooks
│   └── ...
└── docker-compose.yml      # Full local stack
```

## Quickstart

```bash
# Start local development stack
make dev

# Run tests
make test

# Connect to database
make psql

# View API logs
make logs
```

See [docs/spec.md](./docs/spec.md) for the full design specification.

## Tech Stack

- **API**: Python 3.12 + FastAPI + asyncpg + PostgreSQL 16
- **Dashboard**: React 19 + Vite + TypeScript + Tailwind CSS
- **Infrastructure**: Docker + Docker Compose
