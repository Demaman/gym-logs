import uuid

from pydantic import BaseModel

from modules.training.schemas.prescribed_set import PrescribedSetResponse


class ProgramExerciseCreate(BaseModel):
    exercise_id: uuid.UUID
    position: int
    notes: str | None = None
    demo_video_url: str | None = None


class ProgramExerciseUpdate(BaseModel):
    demo_video_url: str | None = None


class ProgramExerciseResponse(BaseModel):
    id: uuid.UUID
    program_day_id: uuid.UUID
    exercise_id: uuid.UUID
    position: int
    notes: str | None
    demo_video_url: str | None
    prescribed_sets: list[PrescribedSetResponse] = []
    model_config = {"from_attributes": True}
