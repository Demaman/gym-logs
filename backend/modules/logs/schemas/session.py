import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from modules.logs.schemas.exercise import LoggedExerciseResponse

SessionModeLiteral = Literal["on_the_fly", "program_driven"]
DayTagLiteral = Literal[
    "push", "pull", "legs", "upper", "lower", "full_body", "cardio", "custom"
]


class WorkoutSessionCreate(BaseModel):
    mode: SessionModeLiteral = "on_the_fly"
    program_day_id: uuid.UUID | None = None
    name: str | None = None  # if None, service auto-generates from mode + date
    day_tag: DayTagLiteral | None = None  # used to auto-name if name is None


class FinishSessionRequest(BaseModel):
    notes: str | None = None
    perceived_difficulty: int | None = None  # 1-10


class SessionSummary(BaseModel):
    duration_seconds: int | None  # None if session not finished
    total_volume_kg: float
    working_sets_count: int
    sets_by_type: dict[str, int]
    exercises_count: int


class WorkoutSessionResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID | None
    athlete_id: uuid.UUID
    program_day_id: uuid.UUID | None
    name: str
    mode: str
    day_tag: DayTagLiteral | None = None
    started_at: datetime
    finished_at: datetime | None
    notes: str | None
    perceived_difficulty: int | None
    logged_exercises: list[LoggedExerciseResponse] = []
    summary: SessionSummary | None = None  # computed and attached by service

    model_config = {"from_attributes": True}
