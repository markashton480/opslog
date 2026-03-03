from datetime import datetime, timezone

from fastapi import APIRouter

from app.config import settings
from app.db import connection
from app.models import categories_payload

router = APIRouter(prefix="/api/v1", tags=["utility"])
STARTED_AT = datetime.now(timezone.utc)


@router.get("/health")
async def health() -> dict:
    db_state = "disconnected"
    async with connection() as conn:
        await conn.fetchval("SELECT 1")
        db_state = "connected"

    uptime = int((datetime.now(timezone.utc) - STARTED_AT).total_seconds())
    return {
        "data": {
            "status": "ok",
            "version": settings.app_version,
            "db": db_state,
            "uptime_seconds": uptime,
        },
        "warnings": [],
    }


@router.get("/categories")
async def categories() -> dict:
    return {"data": categories_payload().model_dump(mode="json"), "warnings": []}
