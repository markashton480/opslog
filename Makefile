.PHONY: dev down test test-api test-dash lint format migrate seed tokens logs psql

dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

down:
	docker compose down -v

test: test-api test-dash

test-api:
	cd api && pytest

test-dash:
	cd dashboard && npm test

lint:
	cd api && ruff check . && cd ../dashboard && npm run lint

format:
	cd api && ruff format . && cd ../dashboard && npm run format

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
