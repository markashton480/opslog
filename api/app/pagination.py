import base64
from datetime import datetime
from uuid import UUID


class CursorError(ValueError):
    pass


def encode_cursor(ingested_at: datetime, event_id: UUID) -> str:
    payload = f"{ingested_at.isoformat()}|{event_id}"
    return base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii")


def decode_cursor(cursor: str) -> tuple[datetime, UUID]:
    try:
        decoded = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
        ts_raw, id_raw = decoded.split("|", maxsplit=1)
        return datetime.fromisoformat(ts_raw), UUID(id_raw)
    except Exception as exc:  # noqa: BLE001
        raise CursorError("Invalid cursor") from exc
