import json
from typing import Any
from uuid import UUID

from asyncpg import UniqueViolationError
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from app.auth import require_roles
from app.db import connection
from app.enums import Role
from app.models import AliasCreate, BriefingResponse, EventResponse, IssueResponse, ServerResponse, ServerUpsert

router = APIRouter(prefix="/api/v1", tags=["servers"])
BRIEFING_EVENTS_LIMIT = 200
BRIEFING_OPEN_ISSUES_LIMIT = 100


async def _resolve_server(conn, name: str):
    row = await conn.fetchrow(
        """
        SELECT s.*
        FROM servers s
        WHERE s.name = $1
        UNION
        SELECT s.*
        FROM server_aliases sa
        JOIN servers s ON s.id = sa.server_id
        WHERE sa.alias_name = $1
        LIMIT 1
        """,
        name,
    )
    return row


async def _aliases_for_server(conn, server_id: UUID) -> list[str]:
    rows = await conn.fetch(
        "SELECT alias_name FROM server_aliases WHERE server_id = $1 ORDER BY alias_name ASC",
        server_id,
    )
    return [row["alias_name"] for row in rows]


def _as_json_object(value: Any) -> dict[str, Any]:
    if isinstance(value, str):
        return json.loads(value)
    return dict(value)


def _row_to_event(row: Any) -> dict[str, Any]:
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
        metadata=_as_json_object(row["metadata"]),
        dedupe_key=row["dedupe_key"],
    ).model_dump(mode="json")


def _row_to_issue(row: Any) -> dict[str, Any]:
    return IssueResponse(
        id=row["id"],
        title=row["title"],
        status=row["status"],
        severity=row["severity"],
        server_id=row["server_id"],
        server_name=row["server_name"],
        first_seen=row["first_seen"],
        last_occurrence=row["last_occurrence"],
        symptoms=row["symptoms"],
        root_cause=row["root_cause"],
        solution=row["solution"],
        created_by=row["created_by"],
        version=row["version"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        resolved_at=row["resolved_at"],
        tags=row["tags"],
        metadata=_as_json_object(row["metadata"]),
        dedupe_key=row["dedupe_key"],
    ).model_dump(mode="json")


def _row_to_server(row: Any, aliases: list[str]) -> dict[str, Any]:
    return ServerResponse(
        id=row["id"],
        name=row["name"],
        display_name=row["display_name"],
        private_ipv4=None if row["private_ipv4"] is None else str(row["private_ipv4"]),
        status=row["status"],
        notes=row["notes"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        aliases=aliases,
    ).model_dump(mode="json")


@router.get("/servers", dependencies=[Depends(require_roles(Role.admin, Role.writer, Role.reader))])
async def list_servers(request: Request):
    async with connection() as conn:
        rows = await conn.fetch(
            """
            SELECT
                s.*,
                COALESCE(
                    array_agg(sa.alias_name ORDER BY sa.alias_name) FILTER (WHERE sa.alias_name IS NOT NULL),
                    '{}'
                ) AS aliases
            FROM servers s
            LEFT JOIN server_aliases sa ON sa.server_id = s.id
            GROUP BY s.id
            ORDER BY s.name ASC
            """
        )

    data = [_row_to_server(row, row["aliases"]) for row in rows]
    return {"data": data, "warnings": list(request.state.warnings)}


@router.get("/servers/{name}/briefing", dependencies=[Depends(require_roles(Role.admin, Role.writer, Role.reader))])
async def server_briefing(name: str, request: Request):
    async with connection() as conn:
        server = await _resolve_server(conn, name)
        if server is None:
            raise HTTPException(status_code=404, detail="server_not_found")

        aliases = await _aliases_for_server(conn, server["id"])

        events = await conn.fetch(
            """
            SELECT *
            FROM events
            WHERE server_id = $1
              AND ingested_at >= NOW() - INTERVAL '48 hours'
            ORDER BY ingested_at DESC, id DESC
            LIMIT $2
            """,
            server["id"],
            BRIEFING_EVENTS_LIMIT,
        )
        open_issues = await conn.fetch(
            """
            SELECT *
            FROM issues
            WHERE server_id = $1
              AND status IN ('open', 'investigating', 'watching')
            ORDER BY updated_at DESC, id DESC
            LIMIT $2
            """,
            server["id"],
            BRIEFING_OPEN_ISSUES_LIMIT,
        )
        summary_row = await conn.fetchrow(
            """
            SELECT
                (SELECT COUNT(*) FROM events e WHERE e.server_id = $1 AND e.ingested_at >= NOW() - INTERVAL '24 hours') AS events_last_24h,
                (SELECT COUNT(*) FROM events e WHERE e.server_id = $1 AND e.ingested_at >= NOW() - INTERVAL '7 days') AS events_last_7d,
                (SELECT COUNT(*) FROM issues i WHERE i.server_id = $1 AND i.status IN ('open', 'investigating', 'watching')) AS open_issue_count,
                (SELECT e.occurred_at FROM events e WHERE e.server_id = $1 AND e.category = 'deployment' ORDER BY e.occurred_at DESC LIMIT 1) AS last_deployment
            """,
            server["id"],
        )

    response = BriefingResponse(
        server=ServerResponse.model_validate(_row_to_server(server, aliases)),
        recent_events=[EventResponse.model_validate(_row_to_event(row)) for row in events],
        open_issues=[IssueResponse.model_validate(_row_to_issue(row)) for row in open_issues],
        summary={
            "events_last_24h": summary_row["events_last_24h"],
            "events_last_7d": summary_row["events_last_7d"],
            "open_issue_count": summary_row["open_issue_count"],
            "last_deployment": summary_row["last_deployment"],
        },
    ).model_dump(mode="json")

    return {"data": response, "warnings": list(request.state.warnings)}


@router.put("/servers/{name}", dependencies=[Depends(require_roles(Role.admin))])
async def upsert_server(name: str, payload: ServerUpsert, request: Request):
    async with connection() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO servers (name, display_name, private_ipv4, status, notes)
            VALUES ($1, $2, $3::inet, $4, $5)
            ON CONFLICT (name)
            DO UPDATE SET
                display_name = EXCLUDED.display_name,
                private_ipv4 = EXCLUDED.private_ipv4,
                status = EXCLUDED.status,
                notes = EXCLUDED.notes
            RETURNING *
            """,
            name,
            payload.display_name,
            payload.private_ipv4,
            payload.status.value,
            payload.notes,
        )
        aliases = await _aliases_for_server(conn, row["id"])

    return {"data": _row_to_server(row, aliases), "warnings": list(request.state.warnings)}


@router.post("/servers/{name}/aliases", dependencies=[Depends(require_roles(Role.admin))])
async def create_server_alias(name: str, payload: AliasCreate, request: Request):
    async with connection() as conn:
        server = await _resolve_server(conn, name)
        if server is None:
            raise HTTPException(status_code=404, detail="server_not_found")

        existing_name = await conn.fetchrow("SELECT id FROM servers WHERE name = $1", payload.alias)
        if existing_name is not None:
            raise HTTPException(status_code=422, detail="alias_conflicts_with_server_name")

        try:
            await conn.execute(
                "INSERT INTO server_aliases (server_id, alias_name) VALUES ($1, $2)",
                server["id"],
                payload.alias,
            )
        except UniqueViolationError as exc:
            raise HTTPException(status_code=422, detail="alias_already_exists") from exc

        aliases = await _aliases_for_server(conn, server["id"])

    return JSONResponse(
        status_code=201,
        content={
            "data": {"server_id": str(server["id"]), "aliases": aliases},
            "warnings": list(request.state.warnings),
        },
    )


@router.delete("/servers/{name}/aliases/{alias}", dependencies=[Depends(require_roles(Role.admin))])
async def delete_server_alias(name: str, alias: str, request: Request):
    async with connection() as conn:
        server = await _resolve_server(conn, name)
        if server is None:
            raise HTTPException(status_code=404, detail="server_not_found")

        result = await conn.execute(
            "DELETE FROM server_aliases WHERE server_id = $1 AND alias_name = $2",
            server["id"],
            alias,
        )
        if result.endswith("0"):
            raise HTTPException(status_code=404, detail="alias_not_found")

        aliases = await _aliases_for_server(conn, server["id"])

    return {
        "data": {"server_id": str(server["id"]), "aliases": aliases},
        "warnings": list(request.state.warnings),
    }
