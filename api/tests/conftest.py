import os
from collections.abc import AsyncIterator

import asyncpg
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Keep default local override-friendly. Compose can set DATABASE_URL to postgres service.
os.environ.setdefault("DATABASE_URL", "postgresql://opslog:opslog@localhost:5432/opslog")

from app.db import close_pool, init_pool, normalize_dsn
from app.main import app
from scripts.migrate import apply_migrations
from scripts.seed import seed


@pytest_asyncio.fixture
async def prepared_database() -> None:
    dsn = normalize_dsn(os.environ["DATABASE_URL"])
    await apply_migrations(dsn)
    await seed(dsn)


@pytest_asyncio.fixture
async def db_conn(prepared_database) -> AsyncIterator[asyncpg.Connection]:
    dsn = normalize_dsn(os.environ["DATABASE_URL"])
    conn = await asyncpg.connect(dsn)
    try:
        await conn.execute(
            """
            TRUNCATE TABLE
                events,
                issue_updates,
                related_issues,
                issues
            RESTART IDENTITY CASCADE
            """
        )
        await conn.execute("UPDATE principals SET last_seen_at = NULL")
        yield conn
    finally:
        await conn.close()


@pytest_asyncio.fixture
async def client(db_conn: asyncpg.Connection) -> AsyncIterator[AsyncClient]:
    await init_pool()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await close_pool()


@pytest.fixture
def writer_headers() -> dict[str, str]:
    return {"Authorization": "Bearer opslog_codex_b_test"}


@pytest.fixture
def admin_headers() -> dict[str, str]:
    return {"Authorization": "Bearer opslog_mark_test"}


@pytest.fixture
def reader_headers() -> dict[str, str]:
    return {"Authorization": "Bearer opslog_readonly_test"}


@pytest.fixture
def revoked_headers() -> dict[str, str]:
    return {"Authorization": "Bearer opslog_revoked_test"}
