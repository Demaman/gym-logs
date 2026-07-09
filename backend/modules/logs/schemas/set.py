import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

SetTypeLiteral = Literal[
    "warm_up",
    "feeder",
    "working",
    "back_off",
    "top_set",
    "failure",
    "drop_set",
    "rest_pause",
    "cluster",
    "burnout",
    "technique",
    "deload",
]


class LoggedSetCreate(BaseModel):
    set_type: SetTypeLiteral = "working"
    weight_kg: float
    reps: int
    rpe: float | None = None
    rir: int | None = None
    is_to_failure: bool = False
    counts_volume: bool | None = None  # if None, service auto-fills from COUNTS_VOLUME_DEFAULT
    tempo: str | None = None
    notes: str | None = None


class LoggedSetUpdate(BaseModel):
    set_type: SetTypeLiteral | None = None
    weight_kg: float | None = None
    reps: int | None = None
    rpe: float | None = None
    rir: int | None = None
    is_to_failure: bool | None = None
    counts_volume: bool | None = None
    tempo: str | None = None
    notes: str | None = None


class LoggedSetResponse(BaseModel):
    id: uuid.UUID
    logged_exercise_id: uuid.UUID
    position: int
    set_type: str
    weight_kg: float
    reps: int
    rpe: float | None
    rir: int | None
    is_to_failure: bool
    counts_volume: bool
    tempo: str | None
    notes: str | None
    recorded_at: datetime

    model_config = {"from_attributes": True}
