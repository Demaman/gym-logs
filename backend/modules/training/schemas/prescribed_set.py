import uuid
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


class PrescribedSetCreate(BaseModel):
    position: int
    set_type: SetTypeLiteral = "working"
    rep_min: int = 8
    rep_max: int = 12
    rpe_target: float | None = None
    rest_seconds: int | None = None
    weight_pct_1rm: float | None = None
    notes: str | None = None


class PrescribedSetResponse(BaseModel):
    id: uuid.UUID
    program_exercise_id: uuid.UUID
    position: int
    set_type: str
    rep_min: int
    rep_max: int
    rpe_target: float | None
    rest_seconds: int | None
    weight_pct_1rm: float | None
    notes: str | None
    model_config = {"from_attributes": True}
