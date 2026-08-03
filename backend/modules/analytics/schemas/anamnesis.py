import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

SexLiteral = Literal["male", "female", "other"]
CompetitionLevelLiteral = Literal["recreational", "amateur", "competitive", "elite"]
GoalLiteral = Literal["strength", "hypertrophy", "fat_loss", "endurance", "sport_performance", "general_fitness"]
DominantSideLiteral = Literal["left", "right"]
BfMethodLiteral = Literal["dexa", "skinfold", "bioimpedance", "navy_formula", "visual"]


class AthleteProfileUpdate(BaseModel):
    date_of_birth: date | None = None
    sex: SexLiteral | None = None
    dominant_side: DominantSideLiteral | None = None
    height_cm: float | None = Field(default=None, gt=0, le=300)
    training_age_years: int | None = Field(default=None, ge=0, le=80)
    training_frequency_available: int | None = Field(default=None, ge=1, le=14)
    primary_sport: str | None = None
    competition_level: CompetitionLevelLiteral | None = None
    primary_goal: GoalLiteral | None = None
    target_event_date: date | None = None
    parq_cleared: bool | None = None
    injury_history: str | None = None
    surgeries: str | None = None
    chronic_conditions: str | None = None
    medications: str | None = None
    contraindications: str | None = None


class AthleteProfileResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    organization_id: uuid.UUID | None
    date_of_birth: date | None
    sex: str | None
    dominant_side: str | None
    height_cm: float | None
    training_age_years: int | None
    training_frequency_available: int | None
    primary_sport: str | None
    competition_level: str | None
    primary_goal: str | None
    target_event_date: date | None
    parq_cleared: bool
    injury_history: str | None
    surgeries: str | None
    chronic_conditions: str | None
    medications: str | None
    contraindications: str | None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class BodyMeasurementCreate(BaseModel):
    measured_at: date
    weight_kg: float | None = Field(default=None, gt=0, le=500)
    body_fat_pct: float | None = Field(default=None, ge=2, le=70)
    lean_mass_kg: float | None = Field(default=None, gt=0)
    bf_method: BfMethodLiteral | None = None
    waist_cm: float | None = Field(default=None, gt=0, le=300)
    hip_cm: float | None = Field(default=None, gt=0, le=300)
    chest_cm: float | None = Field(default=None, gt=0, le=300)
    upper_arm_cm: float | None = Field(default=None, gt=0, le=100)
    thigh_cm: float | None = Field(default=None, gt=0, le=150)
    calf_cm: float | None = Field(default=None, gt=0, le=100)
    resting_hr: int | None = Field(default=None, ge=20, le=220)
    bp_systolic: int | None = Field(default=None, ge=50, le=300)
    bp_diastolic: int | None = Field(default=None, ge=30, le=200)
    notes: str | None = None


class BodyMeasurementUpdate(BaseModel):
    measured_at: date | None = None
    weight_kg: float | None = Field(default=None, gt=0, le=500)
    body_fat_pct: float | None = Field(default=None, ge=2, le=70)
    lean_mass_kg: float | None = Field(default=None, gt=0)
    bf_method: BfMethodLiteral | None = None
    waist_cm: float | None = Field(default=None, gt=0, le=300)
    hip_cm: float | None = Field(default=None, gt=0, le=300)
    chest_cm: float | None = Field(default=None, gt=0, le=300)
    upper_arm_cm: float | None = Field(default=None, gt=0, le=100)
    thigh_cm: float | None = Field(default=None, gt=0, le=100)
    calf_cm: float | None = Field(default=None, gt=0, le=100)
    resting_hr: int | None = Field(default=None, ge=20, le=220)
    bp_systolic: int | None = Field(default=None, ge=50, le=300)
    bp_diastolic: int | None = Field(default=None, ge=30, le=200)
    notes: str | None = None


class BodyMeasurementResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    measured_at: date
    weight_kg: float | None
    body_fat_pct: float | None
    lean_mass_kg: float | None
    bf_method: str | None
    waist_cm: float | None
    hip_cm: float | None
    chest_cm: float | None
    upper_arm_cm: float | None
    thigh_cm: float | None
    calf_cm: float | None
    resting_hr: int | None
    bp_systolic: int | None
    bp_diastolic: int | None
    notes: str | None
    created_at: datetime
    model_config = {"from_attributes": True}
