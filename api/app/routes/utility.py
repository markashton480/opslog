from datetime import UTC, datetime

from fastapi import APIRouter, Request

from app.config import settings
from app.db import connection
from app.models import categories_payload

router = APIRouter(prefix="/api/v1", tags=["utility"])
STARTED_AT = datetime.now(UTC)


@router.get("/health")
async def health() -> dict:
    db_state = "disconnected"
    async with connection() as conn:
        await conn.fetchval("SELECT 1")
        db_state = "connected"

    uptime = int((datetime.now(UTC) - STARTED_AT).total_seconds())
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


@router.get("/me")
async def me(request: Request) -> dict:
    return {
        "data": {
            "principal": request.state.principal,
            "role": request.state.role,
            "auth_source": request.state.auth_source,
        },
        "warnings": list(request.state.warnings),
    }
