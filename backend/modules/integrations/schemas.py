import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

# Sources reserved for internal use — external callers may not use these.
_RESERVED_SOURCES = frozenset({"session_log", "manual"})


class AttendanceWebhookRequest(BaseModel):
    email: str = Field(..., description="Member email as registered in gym-logs")
    source: str = Field(
        ...,
        min_length=1,
        max_length=32,
        description="Platform identifier, e.g. 'wellhub', 'totalpass', 'sesi'",
    )
    external_ref: str | None = Field(
        None,
        max_length=128,
        description="Optional external reference ID (transaction ID, member ID, etc.)",
    )
    checked_in_at: datetime | None = Field(
        None,
        description="Check-in timestamp (UTC). Defaults to now if omitted.",
    )

    @field_validator("source")
    @classmethod
    def source_not_reserved(cls, v: str) -> str:
        if v.lower() in _RESERVED_SOURCES:
            raise ValueError(f"'{v}' is a reserved source name")
        return v.lower()


class AttendanceWebhookResponse(BaseModel):
    recorded: bool
    user_id: uuid.UUID
    message: str
