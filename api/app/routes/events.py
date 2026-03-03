import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from asyncpg import ForeignKeyViolationError
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from app.auth import require_roles
from app.db import connection
from app.enums import EventCategory, Role
from app.models import EventCreate, EventResponse
from app.pagination import CursorError, decode_cursor, encode_cursor

router = APIRouter(prefix="/api/v1", tags=["events"])


def _row_to_event(row: Any) -> dict[str, Any]:
    metadata = row["metadata"]
    if isinstance(metadata, str):
        metadata = json.loads(metadata)

    return EventResponse(
        id=row["id"],
        occurred_at=row["occurred_at"],
        ingested_at=row["ingested_at"],
        principal=row["principal"],
        reported_agent=row["reported_agent"],
        server_id=row["server_id"],
        server_name=row["server_name"],
        category=row["category"],
        summary=row["summary"],
        detail=row["detail"],
        tags=row["tags"],
        issue_id=row["issue_id"],
        corrects_event_id=row["corrects_event_id"],
        metadata=metadata,
        dedupe_key=row["dedupe_key"],
    ).model_dump(mode="json")


async def _resolve_server_id(conn, server_name: str | None):
    if server_name is None:
        return None

    row = await conn.fetchrow(
        """
        SELECT s.id
        FROM servers s
        WHERE s.name = $1
        UNION
        SELECT sa.server_id AS id
        FROM server_aliases sa
        WHERE sa.alias_name = $1
        LIMIT 1
        """,
        server_name,
    )
    return None if row is None else row["id"]


def _empty_list_response(warnings: list[str], limit: int) -> dict[str, Any]:
    return {
        "data": [],
        "next_cursor": None,
        "has_more": False,
        "limit": limit,
        "warnings": warnings,
    }


@router.post("/events", dependencies=[Depends(require_roles(Role.admin, Role.writer))])
async def create_event(payload: EventCreate, request: Request):
    warnings: list[str] = list(request.state.warnings)
    principal = request.state.principal

    async with connection() as conn:
        server_id = await _resolve_server_id(conn, payload.server)
        if payload.server and server_id is None:
            warnings.append(f"unknown-server: {payload.server}")

        if payload.dedupe_key:
            existing = await conn.fetchrow(
                """
                SELECT *
                FROM events
                WHERE principal = $1
                  AND dedupe_key = $2
                LIMIT 1
                """,
                principal,
                payload.dedupe_key,
            )
            if existing is not None:
                return {"data": _row_to_event(existing), "warnings": warnings}

        occurred_at = payload.occurred_at or datetime.now(UTC)

        try:
            row = await conn.fetchrow(
                """
                INSERT INTO events (
                    occurred_at,
                    principal,
                    reported_agent,
                    server_id,
                    server_name,
                    category,
                    summary,
                    detail,
                    tags,
                    issue_id,
                    corrects_event_id,
                    metadata,
                    dedupe_key
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10, $11, $12, $13
                )
                RETURNING *
                """,
                occurred_at,
                principal,
                payload.reported_agent,
                server_id,
                payload.server,
                payload.category.value,
                payload.summary,
                payload.detail,
                payload.tags,
                payload.issue_id,
                payload.corrects_event_id,
                json.dumps(payload.metadata),
                payload.dedupe_key,
            )
        except ForeignKeyViolationError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    return JSONResponse(status_code=201, content={"data": _row_to_event(row), "warnings": warnings})


@router.get("/events", dependencies=[Depends(require_roles(Role.admin, Role.writer, Role.reader))])
async def list_events(
    request: Request,
    server: str | None = None,
    category: str | None = None,
    principal: str | None = None,
    tag: str | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
    since_ingested: datetime | None = None,
    until_ingested: datetime | None = None,
    issue_id: UUID | None = None,
    has_correction: bool | None = None,
    cursor: str | None = None,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int | None = Query(default=None, ge=0),
) -> dict[str, Any]:
    conditions: list[str] = []
    values: list[Any] = []
    warnings: list[str] = list(request.state.warnings)

    async with connection() as conn:
        if server:
            server_id = await _resolve_server_id(conn, server)
            if server_id is None:
                warnings.append(f"unknown-server: {server}")
                return _empty_list_response(warnings, limit)
            values.append(server_id)
            conditions.append(f"e.server_id = ${len(values)}")

        if category:
            raw_categories = [item.strip() for item in category.split(",") if item.strip()]
            allowed_categories = {c.value for c in EventCategory}
            invalid = [item for item in raw_categories if item not in allowed_categories]
            if invalid:
                raise HTTPException(status_code=422, detail=f"invalid categories: {', '.join(invalid)}")
            values.append(raw_categories)
            conditions.append(f"e.category = ANY(${len(values)})")

        if principal:
            values.append(principal)
            conditions.append(f"e.principal = ${len(values)}")

        if tag:
            values.append(tag)
            conditions.append(f"${len(values)} = ANY(e.tags)")

        if since:
            values.append(since)
            conditions.append(f"e.occurred_at >= ${len(values)}")

        if until:
            values.append(until)
            conditions.append(f"e.occurred_at <= ${len(values)}")

        if since_ingested:
            values.append(since_ingested)
            conditions.append(f"e.ingested_at >= ${len(values)}")

        if until_ingested:
            values.append(until_ingested)
            conditions.append(f"e.ingested_at <= ${len(values)}")

        if issue_id:
            values.append(issue_id)
            conditions.append(f"e.issue_id = ${len(values)}")

        if has_correction is True:
            conditions.append("EXISTS (SELECT 1 FROM events c WHERE c.corrects_event_id = e.id)")
        elif has_correction is False:
            conditions.append("NOT EXISTS (SELECT 1 FROM events c WHERE c.corrects_event_id = e.id)")

        if cursor:
            try:
                cursor_ingested_at, cursor_id = decode_cursor(cursor)
            except CursorError as exc:
                raise HTTPException(status_code=422, detail="invalid cursor") from exc
            values.extend([cursor_ingested_at, cursor_id])
            conditions.append(f"(e.ingested_at, e.id) < (${len(values) - 1}, ${len(values)})")

        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)

        offset_clause = ""
        if offset is not None and cursor is None:
            values.append(offset)
            offset_clause = f"OFFSET ${len(values)}"

        values.append(limit + 1)

        query = f"""
            SELECT e.*
            FROM events e
            {where_clause}
            ORDER BY e.ingested_at DESC, e.id DESC
            LIMIT ${len(values)}
            {offset_clause}
        """

        rows = await conn.fetch(query, *values)

    has_more = len(rows) > limit
    trimmed_rows = rows[:limit]
    next_cursor = None
    if has_more and trimmed_rows:
        last = trimmed_rows[-1]
        next_cursor = encode_cursor(last["ingested_at"], last["id"])

    return {
        "data": [_row_to_event(row) for row in trimmed_rows],
        "next_cursor": next_cursor,
        "has_more": has_more,
        "limit": limit,
        "warnings": warnings,
    }


@router.get("/events/{event_id}", dependencies=[Depends(require_roles(Role.admin, Role.writer, Role.reader))])
async def get_event(event_id: UUID, request: Request) -> dict[str, Any]:
    async with connection() as conn:
        row = await conn.fetchrow("SELECT * FROM events WHERE id = $1", event_id)

    if row is None:
        raise HTTPException(status_code=404, detail="event_not_found")

    return {"data": _row_to_event(row), "warnings": list(request.state.warnings)}
