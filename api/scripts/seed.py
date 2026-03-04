#!/usr/bin/env python3
"""Seed baseline data."""

from __future__ import annotations

import asyncio
from pathlib import Path

import asyncpg

from app.db import normalize_dsn

ROOT = Path(__file__).resolve().parents[1]
SEED_FILE = ROOT / "migrations" / "005_seed.sql"


async def seed(dsn: str) -> None:
    conn = await asyncpg.connect(normalize_dsn(dsn))
    try:
        await conn.execute(SEED_FILE.read_text(encoding="utf-8"))
    finally:
        await conn.close()


def main() -> None:
    import os

    dsn = os.environ.get("DATABASE_URL", "postgresql://opslog:opslog@localhost:5432/opslog")
    asyncio.run(seed(dsn))
    print("Seed complete")


if __name__ == "__main__":
    main()
