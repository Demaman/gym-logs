import uuid

from pydantic import BaseModel, model_validator

from modules.logs.schemas.set import LoggedSetResponse


class LoggedExerciseCreate(BaseModel):
    exercise_id: uuid.UUID | None = None  # catalog exercise
    exercise_name_free: str | None = None  # free-form; one of the two must be non-None
    notes: str | None = None

    @model_validator(mode="after")
    def require_exercise_identifier(self) -> "LoggedExerciseCreate":
        if self.exercise_id is None and self.exercise_name_free is None:
            raise ValueError(
                "Either exercise_id or exercise_name_free must be provided."
            )
        return self


class PrescribedSetTarget(BaseModel):
    """A target set from the program day — shown as reference during logging."""
    set_type: str
    rep_min: int
    rep_max: int
    rpe_target: float | None
    rest_seconds: int | None


class LoggedExerciseResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    exercise_id: uuid.UUID | None
    exercise_name_free: str | None
    position: int
    notes: str | None
    logged_sets: list[LoggedSetResponse] = []
    prescribed_sets: list[PrescribedSetTarget] = []

    model_config = {"from_attributes": True}


class ExerciseAverage(BaseModel):
    weight_kg: float | None
    reps: float | None
    rpe: float | None
    total_volume_kg: float
    sets_count: int
    volume_sets_count: int


class PreviousExerciseSession(BaseModel):
    session_name: str
    session_date: str  # ISO date string e.g. "2026-06-28"
    sets: list[LoggedSetResponse]
    average: ExerciseAverage
