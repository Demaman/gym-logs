import uuid
from datetime import datetime

from pydantic import BaseModel

from modules.logs.schemas.session import WorkoutSessionResponse


class BattleResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    battle_code: str
    status: str
    initiator_session_id: uuid.UUID
    opponent_session_id: uuid.UUID | None = None
    created_at: datetime
    finished_at: datetime | None = None


class ExerciseScore(BaseModel):
    exercise_id: uuid.UUID | None
    exercise_name: str
    score: float
    volume_kg: float
    total_reps: int
    max_weight_kg: float
    total_weight_kg: float


class BattleParticipant(BaseModel):
    athlete_id: uuid.UUID
    email: str
    session_id: uuid.UUID
    score: float
    volume_kg: float
    body_weight_kg: float | None
    finished: bool
    exercises: list[ExerciseScore]


class BattleStateResponse(BaseModel):
    id: uuid.UUID
    battle_code: str
    status: str
    finished_at: datetime | None = None
    initiator: BattleParticipant
    opponent: BattleParticipant | None = None


class JoinBattleResponse(BaseModel):
    session: WorkoutSessionResponse
    battle: BattleStateResponse
