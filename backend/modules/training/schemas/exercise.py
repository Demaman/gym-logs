import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from db.constants.training import CoefficientClass

MuscleGroupLiteral = Literal[
    "chest",
    "back",
    "shoulders",
    "biceps",
    "triceps",
    "forearms",
    "core",
    "quads",
    "hamstrings",
    "glutes",
    "calves",
    "full_body",
]
EquipmentLiteral = Literal[
    "barbell",
    "dumbbell",
    "machine",
    "cable",
    "bodyweight",
    "kettlebell",
    "bands",
    "other",
]
MovementPatternLiteral = Literal[
    "push",
    "pull",
    "squat",
    "hinge",
    "carry",
    "rotation",
    "isolation",
]

CoefficientClassLiteral = Literal[
    "machine_isolation",
    "cable_assisted",
    "upper_compound",
    "lower_compound",
    "barbell_compound",
]


class ExerciseCreate(BaseModel):
    name: str
    aliases: list[str] = []
    muscle_group: MuscleGroupLiteral
    secondary_muscles: list[str] = []
    equipment: EquipmentLiteral
    movement_pattern: MovementPatternLiteral
    is_bilateral: bool = True
    notes: str | None = None
    demo_video_url: str | None = None
    coefficient_class: CoefficientClassLiteral | None = None


class ExerciseUpdate(BaseModel):
    name: str | None = None
    aliases: list[str] | None = None
    muscle_group: MuscleGroupLiteral | None = None
    secondary_muscles: list[str] | None = None
    equipment: EquipmentLiteral | None = None
    movement_pattern: MovementPatternLiteral | None = None
    is_bilateral: bool | None = None
    notes: str | None = None
    demo_video_url: str | None = None
    coefficient_class: CoefficientClassLiteral | None = None


class ExerciseResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID | None
    name: str
    aliases: list[str]
    muscle_group: str
    secondary_muscles: list[str]
    equipment: str
    movement_pattern: str
    is_bilateral: bool
    is_global: bool
    notes: str | None
    demo_video_url: str | None
    battle_coefficient: float
    created_at: datetime
    model_config = {"from_attributes": True}
