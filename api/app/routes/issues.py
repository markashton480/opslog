import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from asyncpg import CheckViolationError, ForeignKeyViolationError, UniqueViolationError
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from app.auth import require_roles
from app.db import connection
from app.enums import IssueStatus, RelationshipType, Role, Severity
from app.models import (
    IssueCreate,
    IssueDetailResponse,
    IssuePatch,
    IssueResponse,
    IssueUpdateCreate,
    IssueUpdateResponse,
    RelatedIssueResponse,
    RelateRequest,
)
from app.pagination import CursorError, decode_cursor, encode_cursor

router = APIRouter(prefix="/api/v1", tags=["issues"])

_ALLOWED_TRANSITIONS: dict[IssueStatus, set[IssueStatus]] = {
    IssueStatus.open: {IssueStatus.open, IssueStatus.investigating, IssueStatus.wontfix},
    IssueStatus.investigating: {
        IssueStatus.investigating,
        IssueStatus.watching,
        IssueStatus.open,
        IssueStatus.resolved,
    },
    IssueStatus.watching: {IssueStatus.watching, IssueStatus.open, IssueStatus.resolved},
    IssueStatus.resolved: {IssueStatus.resolved, IssueStatus.open},
    IssueStatus.wontfix: {IssueStatus.wontfix, IssueStatus.open},
}


def _as_json_object(value: Any) -> dict[str, Any]:
    if isinstance(value, str):
        return json.loads(value)
    return dict(value)


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


def _row_to_issue_update(row: Any) -> dict[str, Any]:
    return IssueUpdateResponse(
        id=row["id"],
        issue_id=row["issue_id"],
        occurred_at=row["occurred_at"],
        ingested_at=row["ingested_at"],
        principal=row["principal"],
        content=row["content"],
        status_from=row["status_from"],
        status_to=row["status_to"],
        changes=_as_json_object(row["changes"]),
    ).model_dump(mode="json")


def _format_change_content(changes: dict[str, dict[str, Any]]) -> str:
    if "status" in changes:
        from_status = changes["status"]["from"]
        to_status = changes["status"]["to"]
        return f"Status changed from {from_status} to {to_status}"

    fields = ", ".join(sorted(changes.keys()))
    return f"Issue fields updated: {fields}" if fields else "Issue updated"


def _empty_issue_list_response(warnings: list[str], limit: int) -> dict[str, Any]:
    return {
        "data": [],
        "next_cursor": None,
        "has_more": False,
        "limit": limit,
        "warnings": warnings,
    }


@router.post("/issues", dependencies=[Depends(require_roles(Role.admin, Role.writer))])
async def create_issue(payload: IssueCreate, request: Request):
    warnings: list[str] = list(request.state.warnings)
    principal = request.state.principal
    first_seen = payload.first_seen or datetime.now(UTC)
    last_occurrence = payload.last_occurrence or first_seen

    async with connection() as conn:
        server_id = await _resolve_server_id(conn, payload.server)
        if payload.server and server_id is None:
            warnings.append(f"unknown-server: {payload.server}")

        try:
            row = await conn.fetchrow(
                """
                INSERT INTO issues (
                    title,
                    status,
                    severity,
                    server_id,
                    server_name,
                    first_seen,
                    last_occurrence,
                    symptoms,
                    root_cause,
                    solution,
                    created_by,
                    tags,
                    metadata,
                    dedupe_key
                ) VALUES (
                    $1, 'open', $2, $3, $4, $5, $6, $7,
                    $8, $9, $10, $11, $12, $13
                )
                ON CONFLICT (created_by, dedupe_key)
                WHERE dedupe_key IS NOT NULL
                DO NOTHING
                RETURNING *
                """,
                payload.title,
                payload.severity.value,
                server_id,
                payload.server,
                first_seen,
                last_occurrence,
                payload.symptoms,
                payload.root_cause,
                payload.solution,
                principal,
                payload.tags,
                json.dumps(payload.metadata),
                payload.dedupe_key,
            )
        except ForeignKeyViolationError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        if row is None and payload.dedupe_key:
            existing = await conn.fetchrow(
                """
                SELECT *
                FROM issues
                WHERE created_by = $1
                  AND dedupe_key = $2
                LIMIT 1
                """,
                principal,
                payload.dedupe_key,
            )
            if existing is not None:
                return {"data": _row_to_issue(existing), "warnings": warnings}
            raise HTTPException(status_code=500, detail="failed_dedupe_lookup")

    return JSONResponse(status_code=201, content={"data": _row_to_issue(row), "warnings": warnings})


@router.get("/issues", dependencies=[Depends(require_roles(Role.admin, Role.writer, Role.reader))])
async def list_issues(
    request: Request,
    status: str | None = None,
    severity: str | None = None,
    server: str | None = None,
    tag: str | None = None,
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    warnings: list[str] = list(request.state.warnings)
    conditions: list[str] = []
    values: list[Any] = []

    async with connection() as conn:
        if status:
            raw_statuses = [item.strip() for item in status.split(",") if item.strip()]
            allowed_statuses = {item.value for item in IssueStatus}
            invalid = [item for item in raw_statuses if item not in allowed_statuses]
            if invalid:
                raise HTTPException(status_code=422, detail=f"invalid statuses: {', '.join(invalid)}")
            values.append(raw_statuses)
            conditions.append(f"i.status = ANY(${len(values)})")

        if severity:
            raw_severities = [item.strip() for item in severity.split(",") if item.strip()]
            allowed_severities = {item.value for item in Severity}
            invalid = [item for item in raw_severities if item not in allowed_severities]
            if invalid:
                raise HTTPException(status_code=422, detail=f"invalid severities: {', '.join(invalid)}")
            values.append(raw_severities)
            conditions.append(f"i.severity = ANY(${len(values)})")

        if server:
            server_id = await _resolve_server_id(conn, server)
            if server_id is None:
                warnings.append(f"unknown-server: {server}")
                return _empty_issue_list_response(warnings, limit)
            values.append(server_id)
            conditions.append(f"i.server_id = ${len(values)}")

        if tag:
            values.append(tag)
            conditions.append(f"${len(values)} = ANY(i.tags)")

        if cursor:
            try:
                cursor_updated_at, cursor_id = decode_cursor(cursor)
            except CursorError as exc:
                raise HTTPException(status_code=422, detail="invalid cursor") from exc
            values.extend([cursor_updated_at, cursor_id])
            conditions.append(f"(i.updated_at, i.id) < (${len(values) - 1}, ${len(values)})")

        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)

        values.append(limit + 1)
        rows = await conn.fetch(
            f"""
            SELECT i.*
            FROM issues i
            {where_clause}
            ORDER BY i.updated_at DESC, i.id DESC
            LIMIT ${len(values)}
            """,
            *values,
        )

    has_more = len(rows) > limit
    trimmed_rows = rows[:limit]
    next_cursor = None
    if has_more and trimmed_rows:
        last = trimmed_rows[-1]
        next_cursor = encode_cursor(last["updated_at"], last["id"])

    return {
        "data": [_row_to_issue(row) for row in trimmed_rows],
        "next_cursor": next_cursor,
        "has_more": has_more,
        "limit": limit,
        "warnings": warnings,
    }


@router.get("/issues/{issue_id}", dependencies=[Depends(require_roles(Role.admin, Role.writer, Role.reader))])
async def get_issue(issue_id: UUID, request: Request) -> dict[str, Any]:
    async with connection() as conn:
        issue_row = await conn.fetchrow("SELECT * FROM issues WHERE id = $1", issue_id)
        if issue_row is None:
            raise HTTPException(status_code=404, detail="issue_not_found")

        updates = await conn.fetch(
            """
            SELECT *
            FROM issue_updates
            WHERE issue_id = $1
            ORDER BY occurred_at ASC, id ASC
            """,
            issue_id,
        )
        related_rows = await conn.fetch(
            """
            SELECT
                CASE
                    WHEN r.src_issue_id = $1 THEN r.dst_issue_id
                    ELSE r.src_issue_id
                END AS related_issue_id,
                r.relationship,
                i.*
            FROM related_issues r
            JOIN issues i ON i.id = CASE WHEN r.src_issue_id = $1 THEN r.dst_issue_id ELSE r.src_issue_id END
            WHERE r.src_issue_id = $1 OR r.dst_issue_id = $1
            ORDER BY i.updated_at DESC
            """,
            issue_id,
        )

    detail = IssueDetailResponse(
        issue=IssueResponse.model_validate(_row_to_issue(issue_row)),
        updates=[IssueUpdateResponse.model_validate(_row_to_issue_update(row)) for row in updates],
        related_issues=[
            RelatedIssueResponse(
                related_issue_id=row["related_issue_id"],
                relationship=row["relationship"],
                issue=IssueResponse.model_validate(_row_to_issue(row)),
            )
            for row in related_rows
        ],
    ).model_dump(mode="json")

    return {"data": detail, "warnings": list(request.state.warnings)}


@router.patch("/issues/{issue_id}", dependencies=[Depends(require_roles(Role.admin, Role.writer))])
async def patch_issue(issue_id: UUID, payload: IssuePatch, request: Request):
    warnings: list[str] = list(request.state.warnings)
    principal = request.state.principal
    patch_data = payload.model_dump(exclude_unset=True)
    expected_version = patch_data.pop("version")

    if not patch_data:
        raise HTTPException(status_code=422, detail="no_fields_to_update")

    try:
        async with connection() as conn:
            async with conn.transaction():
                current = await conn.fetchrow("SELECT * FROM issues WHERE id = $1 FOR UPDATE", issue_id)
                if current is None:
                    raise HTTPException(status_code=404, detail="issue_not_found")

                if current["version"] != expected_version:
                    return JSONResponse(
                        status_code=409,
                        content={
                            "data": {"error": "version_conflict", "current": _row_to_issue(current)},
                            "warnings": warnings,
                        },
                    )

                updates: dict[str, Any] = {}
                changes: dict[str, dict[str, Any]] = {}

                if "status" in patch_data:
                    target_status = IssueStatus(patch_data["status"])
                    source_status = IssueStatus(current["status"])
                    if target_status not in _ALLOWED_TRANSITIONS[source_status]:
                        raise HTTPException(
                            status_code=422,
                            detail=f"invalid status transition: {source_status.value} -> {target_status.value}",
                        )
                    if target_status != source_status:
                        updates["status"] = target_status.value
                        changes["status"] = {"from": source_status.value, "to": target_status.value}
                        if target_status in {IssueStatus.resolved, IssueStatus.wontfix}:
                            updates["resolved_at"] = datetime.now(UTC)
                            changes["resolved_at"] = {
                                "from": current["resolved_at"],
                                "to": updates["resolved_at"],
                            }
                        elif source_status in {IssueStatus.resolved, IssueStatus.wontfix}:
                            updates["resolved_at"] = None
                            changes["resolved_at"] = {"from": current["resolved_at"], "to": None}

                if "severity" in patch_data:
                    new_severity = Severity(patch_data["severity"]).value
                    if new_severity != current["severity"]:
                        updates["severity"] = new_severity
                        changes["severity"] = {"from": current["severity"], "to": new_severity}

                if "title" in patch_data and patch_data["title"] != current["title"]:
                    updates["title"] = patch_data["title"]
                    changes["title"] = {"from": current["title"], "to": patch_data["title"]}

                if (
                    "last_occurrence" in patch_data
                    and patch_data["last_occurrence"] != current["last_occurrence"]
                ):
                    updates["last_occurrence"] = patch_data["last_occurrence"]
                    changes["last_occurrence"] = {
                        "from": current["last_occurrence"],
                        "to": patch_data["last_occurrence"],
                    }

                for field_name in ["symptoms", "root_cause", "solution", "tags"]:
                    if field_name in patch_data and patch_data[field_name] != current[field_name]:
                        updates[field_name] = patch_data[field_name]
                        changes[field_name] = {"from": current[field_name], "to": patch_data[field_name]}

                if "metadata" in patch_data:
                    current_metadata = _as_json_object(current["metadata"])
                    if patch_data["metadata"] != current_metadata:
                        updates["metadata"] = json.dumps(patch_data["metadata"])
                        changes["metadata"] = {"from": current_metadata, "to": patch_data["metadata"]}

                if "server" in patch_data:
                    server_name = patch_data["server"]
                    server_id = await _resolve_server_id(conn, server_name)
                    if server_name and server_id is None:
                        warnings.append(f"unknown-server: {server_name}")

                    if server_id != current["server_id"]:
                        updates["server_id"] = server_id
                        changes["server_id"] = {"from": current["server_id"], "to": server_id}
                    if server_name != current["server_name"]:
                        updates["server_name"] = server_name
                        changes["server_name"] = {"from": current["server_name"], "to": server_name}

                if not updates:
                    return {"data": _row_to_issue(current), "warnings": warnings}

                set_clauses: list[str] = []
                params: list[Any] = []
                for idx, (field_name, field_value) in enumerate(updates.items(), start=1):
                    set_clauses.append(f"{field_name} = ${idx}")
                    params.append(field_value)

                params.append(issue_id)
                updated = await conn.fetchrow(
                    f"""
                    UPDATE issues
                    SET {', '.join(set_clauses)}
                    WHERE id = ${len(params)}
                    RETURNING *
                    """,
                    *params,
                )

                await conn.execute(
                    """
                    INSERT INTO issue_updates (issue_id, principal, content, status_from, status_to, changes)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    """,
                    issue_id,
                    principal,
                    _format_change_content(changes),
                    changes.get("status", {}).get("from"),
                    changes.get("status", {}).get("to"),
                    json.dumps(jsonable_encoder(changes)),
                )
    except CheckViolationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return {"data": _row_to_issue(updated), "warnings": warnings}


@router.post("/issues/{issue_id}/updates", dependencies=[Depends(require_roles(Role.admin, Role.writer))])
async def create_issue_update(issue_id: UUID, payload: IssueUpdateCreate, request: Request):
    principal = request.state.principal
    occurred_at = payload.occurred_at or datetime.now(UTC)

    async with connection() as conn:
        async with conn.transaction():
            issue_row = await conn.fetchrow("SELECT id FROM issues WHERE id = $1 FOR UPDATE", issue_id)
            if issue_row is None:
                raise HTTPException(status_code=404, detail="issue_not_found")

            await conn.execute(
                """
                UPDATE issues
                SET last_occurrence = GREATEST(last_occurrence, $2)
                WHERE id = $1
                """,
                issue_id,
                occurred_at,
            )
            update_row = await conn.fetchrow(
                """
                INSERT INTO issue_updates (issue_id, occurred_at, principal, content, status_from, status_to, changes)
                VALUES ($1, $2, $3, $4, NULL, NULL, '{}'::jsonb)
                RETURNING *
                """,
                issue_id,
                occurred_at,
                principal,
                payload.content,
            )

    return JSONResponse(
        status_code=201,
        content={"data": _row_to_issue_update(update_row), "warnings": list(request.state.warnings)},
    )


@router.post("/issues/{issue_id}/relate", dependencies=[Depends(require_roles(Role.admin, Role.writer))])
async def relate_issues(issue_id: UUID, payload: RelateRequest, request: Request):
    if issue_id == payload.related_issue_id:
        raise HTTPException(status_code=422, detail="cannot_relate_issue_to_itself")

    src_issue = issue_id
    dst_issue = payload.related_issue_id
    if payload.relationship == RelationshipType.related and src_issue.int > dst_issue.int:
        src_issue, dst_issue = dst_issue, src_issue

    async with connection() as conn:
        try:
            relation = await conn.fetchrow(
                """
                INSERT INTO related_issues (src_issue_id, dst_issue_id, relationship)
                VALUES ($1, $2, $3)
                RETURNING *
                """,
                src_issue,
                dst_issue,
                payload.relationship.value,
            )
        except ForeignKeyViolationError as exc:
            raise HTTPException(status_code=422, detail="issue_not_found") from exc
        except UniqueViolationError as exc:
            relation = await conn.fetchrow(
                """
                SELECT *
                FROM related_issues
                WHERE src_issue_id = $1
                  AND dst_issue_id = $2
                  AND relationship = $3
                """,
                src_issue,
                dst_issue,
                payload.relationship.value,
            )
            if relation is None and payload.relationship == RelationshipType.duplicate_of:
                raise HTTPException(status_code=422, detail="duplicate_of_already_exists") from exc
            if relation is None:
                raise HTTPException(status_code=422, detail="relationship_already_exists") from exc

    return {
        "data": {
            "src_issue_id": str(relation["src_issue_id"]),
            "dst_issue_id": str(relation["dst_issue_id"]),
            "relationship": relation["relationship"],
        },
        "warnings": list(request.state.warnings),
    }
