.PHONY: dev down test test-api test-dash lint format migrate seed tokens logs psql install-deps

dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d

down:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v

test: test-api test-dash

test-api:
	docker compose -f docker-compose.yml run --rm -e PYTHONPATH=/app/app api pytest /app/app/tests

test-dash:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm dashboard npm test

install-deps:
	cd api && pip install -e ".[dev]"
	cd dashboard && npm install

lint:
	docker compose -f docker-compose.yml run --rm api ruff check .
	docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm dashboard npm run lint

format:
	docker compose -f docker-compose.yml run --rm api ruff format .
	docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm dashboard npm run format

migrate:
	docker compose -f docker-compose.yml exec api python scripts/migrate.py

seed:
	docker compose -f docker-compose.yml exec api python scripts/seed.py

tokens:
	docker compose -f docker-compose.yml exec api python scripts/generate_tokens.py

logs:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f api

psql:
	docker compose -f docker-compose.yml exec postgres psql -U opslog -d opslog
