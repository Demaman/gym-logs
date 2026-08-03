import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from modules.training.schemas.program_day import ProgramDayResponse

SessionModeLiteral = Literal["on_the_fly", "program_driven"]


class ProgramCreate(BaseModel):
    name: str
    description: str | None = None
    mode: SessionModeLiteral = "on_the_fly"
    athlete_id: uuid.UUID | None = None


class ProgramUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    mode: SessionModeLiteral | None = None


class ProgramResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID | None
    athlete_id: uuid.UUID | None
    name: str
    description: str | None
    mode: str
    is_active: bool
    created_at: datetime
    days: list[ProgramDayResponse] = []
    model_config = {"from_attributes": True}
