import uuid
from datetime import UTC, date, datetime

from sqlalchemy import Date, DateTime, Enum, Float, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base
from db.constants.analytics import SCHEMA

BfMethod = Enum(
    "dexa", "skinfold", "bioimpedance", "navy_formula", "visual",
    name="bf_method_type", schema=SCHEMA,
)


class BodyMeasurement(Base):
    __tablename__ = "body_measurements"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    measured_at: Mapped[date] = mapped_column(Date, nullable=False)

    # Composition
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    body_fat_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    lean_mass_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    bf_method: Mapped[str | None] = mapped_column(BfMethod, nullable=True)

    # Circumferences (cm)
    waist_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    hip_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    chest_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    upper_arm_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    thigh_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    calf_cm: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Vitals
    resting_hr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bp_systolic: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bp_diastolic: Mapped[int | None] = mapped_column(Integer, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
