import uuid
from datetime import UTC, date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base
from db.constants.analytics import SCHEMA

Sex = Enum("male", "female", "other", name="sex_type", schema=SCHEMA)
CompetitionLevel = Enum(
    "recreational", "amateur", "competitive", "elite",
    name="competition_level_type", schema=SCHEMA,
)
GoalType = Enum(
    "strength", "hypertrophy", "fat_loss", "endurance",
    "sport_performance", "general_fitness",
    name="goal_type", schema=SCHEMA,
)
DominantSide = Enum("left", "right", name="dominant_side_type", schema=SCHEMA)


class AthleteProfile(Base):
    __tablename__ = "athlete_profiles"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Personal
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    sex: Mapped[str | None] = mapped_column(Sex, nullable=True)
    dominant_side: Mapped[str | None] = mapped_column(DominantSide, nullable=True)
    height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Training background
    training_age_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    training_frequency_available: Mapped[int | None] = mapped_column(Integer, nullable=True)
    primary_sport: Mapped[str | None] = mapped_column(String(255), nullable=True)
    competition_level: Mapped[str | None] = mapped_column(CompetitionLevel, nullable=True)

    # Goals
    primary_goal: Mapped[str | None] = mapped_column(GoalType, nullable=True)
    target_event_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Health
    parq_cleared: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    injury_history: Mapped[str | None] = mapped_column(Text, nullable=True)
    surgeries: Mapped[str | None] = mapped_column(Text, nullable=True)
    chronic_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    medications: Mapped[str | None] = mapped_column(Text, nullable=True)
    contraindications: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
