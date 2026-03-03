import json
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.config import settings
from app.enums import CATEGORY_DESCRIPTIONS, EventCategory


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
        encoded = json.dumps(value, separators=(",", ":")).encode("utf-8")
        if len(encoded) > settings.max_metadata_bytes:
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
