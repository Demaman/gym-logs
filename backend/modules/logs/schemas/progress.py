from pydantic import BaseModel


class ProgressStats(BaseModel):
    total_sessions: int
    total_volume_kg: float
    sessions_this_month: int
    avg_volume_per_session: float


class WeeklyVolumePoint(BaseModel):
    week_start: str
    volume_kg: float


class WeeklyVolumeSeries(BaseModel):
    points: list[WeeklyVolumePoint]


class ExerciseHistoryPoint(BaseModel):
    session_date: str
    session_name: str
    best_weight_kg: float | None
    volume_kg: float


class ExerciseHistorySeries(BaseModel):
    exercise_name: str | None
    points: list[ExerciseHistoryPoint]
