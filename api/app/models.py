import ipaddress
import json
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.config import settings
from app.enums import (
    CATEGORY_DESCRIPTIONS,
    EventCategory,
    IssueStatus,
    RelationshipType,
    ServerStatus,
    Severity,
)


def _json_size(value: dict[str, Any]) -> int:
    return len(json.dumps(value, separators=(",", ":")).encode("utf-8"))


class EventCreate(BaseModel):
    server: str | None = Field(default=None, max_length=255)
    category: EventCategory
    summary: str = Field(min_length=1, max_length=1024)
    detail: str | None = None
    tags: list[str] = Field(default_factory=list, max_length=50)
    issue_id: UUID | None = None
    corrects_event_id: UUID | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    occurred_at: datetime | None = None
    reported_agent: str | None = Field(default=None, max_length=255)
    dedupe_key: str | None = Field(default=None, max_length=255)

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: list[str]) -> list[str]:
        if len(value) > 50:
            raise ValueError("tags must contain at most 50 items")
        return value

    @field_validator("detail")
    @classmethod
    def validate_detail_size(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if len(value.encode("utf-8")) > settings.max_detail_bytes:
            raise ValueError("detail exceeds 200KB")
        return value

    @field_validator("metadata")
    @classmethod
    def validate_metadata_size(cls, value: dict[str, Any]) -> dict[str, Any]:
        if _json_size(value) > settings.max_metadata_bytes:
            raise ValueError("metadata exceeds 200KB")
        return value


class EventResponse(BaseModel):
    id: UUID
    occurred_at: datetime
    ingested_at: datetime
    principal: str
    reported_agent: str | None
    server_id: UUID | None
    server_name: str | None
    category: EventCategory
    summary: str
    detail: str | None
    tags: list[str]
    issue_id: UUID | None
    corrects_event_id: UUID | None
    metadata: dict[str, Any]
    dedupe_key: str | None


class IssueCreate(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    severity: Severity = Severity.medium
    server: str | None = Field(default=None, max_length=255)
    first_seen: datetime | None = None
    last_occurrence: datetime | None = None
    symptoms: str | None = None
    root_cause: str | None = None
    solution: str | None = None
    tags: list[str] = Field(default_factory=list, max_length=50)
    metadata: dict[str, Any] = Field(default_factory=dict)
    dedupe_key: str | None = Field(default=None, max_length=255)

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: list[str]) -> list[str]:
        if len(value) > 50:
            raise ValueError("tags must contain at most 50 items")
        return value

    @field_validator("metadata")
    @classmethod
    def validate_metadata_size(cls, value: dict[str, Any]) -> dict[str, Any]:
        if _json_size(value) > settings.max_metadata_bytes:
            raise ValueError("metadata exceeds 200KB")
        return value

    @model_validator(mode="after")
    def validate_occurrence_window(self):
        if self.first_seen and self.last_occurrence and self.last_occurrence < self.first_seen:
            raise ValueError("last_occurrence must be >= first_seen")
        return self


class IssuePatch(BaseModel):
    version: int = Field(ge=1)
    title: str | None = Field(default=None, max_length=512)
    status: IssueStatus | None = None
    severity: Severity | None = None
    server: str | None = Field(default=None, max_length=255)
    last_occurrence: datetime | None = None
    symptoms: str | None = None
    root_cause: str | None = None
    solution: str | None = None
    tags: list[str] | None = Field(default=None, max_length=50)
    metadata: dict[str, Any] | None = None

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return value
        if len(value) > 50:
            raise ValueError("tags must contain at most 50 items")
        return value

    @field_validator("metadata")
    @classmethod
    def validate_metadata_size(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if value is None:
            return value
        if _json_size(value) > settings.max_metadata_bytes:
            raise ValueError("metadata exceeds 200KB")
        return value


class IssueUpdateCreate(BaseModel):
    content: str = Field(min_length=1)
    occurred_at: datetime | None = None

    @field_validator("content")
    @classmethod
    def validate_content_size(cls, value: str) -> str:
        if len(value.encode("utf-8")) > settings.max_detail_bytes:
            raise ValueError("content exceeds 200KB")
        return value


class RelateRequest(BaseModel):
    related_issue_id: UUID
    relationship: RelationshipType


class IssueResponse(BaseModel):
    id: UUID
    title: str
    status: IssueStatus
    severity: Severity
    server_id: UUID | None
    server_name: str | None
    first_seen: datetime
    last_occurrence: datetime
    symptoms: str | None
    root_cause: str | None
    solution: str | None
    created_by: str
    version: int
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None
    tags: list[str]
    metadata: dict[str, Any]
    dedupe_key: str | None


class IssueUpdateResponse(BaseModel):
    id: UUID
    issue_id: UUID
    occurred_at: datetime
    ingested_at: datetime
    principal: str
    content: str
    status_from: IssueStatus | None
    status_to: IssueStatus | None
    changes: dict[str, Any]


class RelatedIssueResponse(BaseModel):
    related_issue_id: UUID
    relationship: RelationshipType
    issue: IssueResponse


class IssueDetailResponse(BaseModel):
    issue: IssueResponse
    updates: list[IssueUpdateResponse]
    related_issues: list[RelatedIssueResponse]


class ServerUpsert(BaseModel):
    display_name: str = Field(min_length=1, max_length=255)
    private_ipv4: str | None = None
    status: ServerStatus = ServerStatus.active
    notes: str | None = None

    @field_validator("private_ipv4")
    @classmethod
    def validate_private_ipv4(cls, value: str | None) -> str | None:
        if value is None:
            return value
        address = ipaddress.ip_address(value)
        if address.version != 4:
            raise ValueError("private_ipv4 must be an IPv4 address")
        return value


class AliasCreate(BaseModel):
    alias: str = Field(min_length=1, max_length=255)


class ServerResponse(BaseModel):
    id: UUID
    name: str
    display_name: str
    private_ipv4: str | None
    status: ServerStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime
    aliases: list[str] = Field(default_factory=list)


class BriefingSummaryResponse(BaseModel):
    events_last_24h: int
    events_last_7d: int
    open_issue_count: int
    last_deployment: datetime | None


class BriefingResponse(BaseModel):
    server: ServerResponse
    recent_events: list[EventResponse]
    open_issues: list[IssueResponse]
    summary: BriefingSummaryResponse


class HealthResponse(BaseModel):
    status: str
    version: str
    db: str
    uptime_seconds: int


class CategoryItem(BaseModel):
    name: EventCategory
    description: str


class CategoriesResponse(BaseModel):
    categories: list[CategoryItem]


def categories_payload() -> CategoriesResponse:
    items = [
        CategoryItem(name=category, description=description)
        for category, description in CATEGORY_DESCRIPTIONS.items()
    ]
    return CategoriesResponse(categories=items)
