.PHONY: dev down test test-api test-dash lint format migrate seed tokens logs psql install-deps

dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

down:
	docker compose down -v

test: test-api test-dash

test-api:
	docker compose exec api pytest

test-dash:
	docker compose run --rm dashboard npm test

install-deps:
	cd api && pip install -e ".[dev]"
	cd dashboard && npm install

lint:
	docker compose exec api ruff check .
	docker compose run --rm dashboard npm run lint

format:
	docker compose exec api ruff format .
	docker compose run --rm dashboard npm run format

migrate:
	docker compose exec api python scripts/migrate.py

seed:
	docker compose exec api python scripts/seed.py

tokens:
	docker compose exec api python scripts/generate_tokens.py

logs:
	docker compose logs -f api

psql:
	docker compose exec postgres psql -U opslog -d opslog
