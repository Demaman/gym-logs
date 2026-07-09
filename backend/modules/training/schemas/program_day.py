import uuid
from typing import Literal

from pydantic import BaseModel

from modules.training.schemas.program_exercise import ProgramExerciseResponse

DayTagLiteral = Literal[
    "push",
    "pull",
    "legs",
    "upper",
    "lower",
    "full_body",
    "cardio",
    "custom",
]


class ProgramDayCreate(BaseModel):
    name: str
    position: int
    day_tag: DayTagLiteral


class ProgramDayUpdate(BaseModel):
    name: str | None = None
    position: int | None = None
    day_tag: DayTagLiteral | None = None


class ProgramDayResponse(BaseModel):
    id: uuid.UUID
    program_id: uuid.UUID
    name: str
    position: int
    day_tag: str
    exercises: list[ProgramExerciseResponse] = []
    model_config = {"from_attributes": True}
