import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

MemberStatus = Literal["active", "at_risk", "dormant", "no_program", "new"]

_STATUS_ORDER = {"new": 0, "at_risk": 1, "no_program": 2, "dormant": 3, "active": 4}


class MemberHealthResponse(BaseModel):
    user_id: uuid.UUID
    email: str
    joined_at: datetime
    status: MemberStatus
    last_session_at: datetime | None
    days_since_last_session: int | None
    active_program_count: int
