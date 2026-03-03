.PHONY: dev down test test-api test-dash lint format migrate seed tokens logs psql install-deps build up

# --- Development ---
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d

down:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v

test: test-api test-dash

test-api:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm -e PYTHONPATH=/app api pytest tests/

test-dash:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm dashboard npm test

install-deps:
	cd api && pip install -e ".[dev]"
	cd dashboard && npm install

lint:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm api ruff check .
	docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm dashboard npm run lint

format:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm api ruff format .
	docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm dashboard npm run format

# --- Production ---
build:
	docker compose build

up:
	docker compose up -d

# --- Database ---
migrate:
	docker compose exec api python scripts/migrate.py

seed:
	docker compose exec api python scripts/seed.py

tokens:
	docker compose exec api python scripts/generate_tokens.py

# --- Utilities ---
logs:
	docker compose logs -f api

psql:
	docker compose exec postgres psql -U $${POSTGRES_USER:-opslog} -d $${POSTGRES_DB:-opslog}
