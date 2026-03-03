#!/usr/bin/env python3
"""Run database migrations in order."""

from __future__ import annotations

import asyncio
from pathlib import Path

import asyncpg

from app.db import normalize_dsn

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = ROOT / "migrations"


def _default_dsn() -> str:
    return "postgresql://opslog:opslog@localhost:5432/opslog"


async def apply_migrations(dsn: str) -> list[str]:
    conn = await asyncpg.connect(normalize_dsn(dsn))
    try:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS _migrations (
                filename TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )

        applied = {
            row["filename"]
            for row in await conn.fetch("SELECT filename FROM _migrations")
        }

        executed: list[str] = []
        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if path.name in applied:
                continue
            sql = path.read_text(encoding="utf-8")
            async with conn.transaction():
                await conn.execute(sql)
                await conn.execute(
                    "INSERT INTO _migrations (filename) VALUES ($1)",
                    path.name,
                )
            executed.append(path.name)

        return executed
    finally:
        await conn.close()


def main() -> None:
    import os

    dsn = os.environ.get("DATABASE_URL", _default_dsn())
    executed = asyncio.run(apply_migrations(dsn))
    if executed:
        print("Applied migrations:")
        for item in executed:
            print(f"- {item}")
    else:
        print("No migrations to apply")


if __name__ == "__main__":
    main()
