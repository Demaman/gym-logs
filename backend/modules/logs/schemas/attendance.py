import uuid
from datetime import datetime

from pydantic import BaseModel


class AttendanceCheckinRequest(BaseModel):
    user_id: uuid.UUID


class HeatmapPoint(BaseModel):
    day_of_week: int
    hour: int
    count: int


class MemberAttendance(BaseModel):
    user_id: uuid.UUID
    email: str
    sessions_count: int
    last_checkin: datetime | None


class AttendanceSummary(BaseModel):
    today_count: int
    yesterday_count: int
    this_week_count: int
    last_week_count: int
    heatmap: list[HeatmapPoint]
    per_member: list[MemberAttendance]
