import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base
from db.constants.logs import SCHEMA


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"
    __table_args__ = (
        Index("ix_session_athlete_started", "organization_id", "athlete_id", "started_at"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("identity.organizations.id"),
        nullable=True,
        index=True,
    )
    athlete_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("identity.users.id"),
        nullable=False,
    )
    program_day_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("training.program_days.id"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    mode: Mapped[str] = mapped_column(
        Enum(
            "on_the_fly",
            "program_driven",
            name="session_mode",
            schema="training",
            create_type=False,
        ),
        nullable=False,
    )
    day_tag: Mapped[str | None] = mapped_column(
        Enum(
            "push", "pull", "legs", "upper", "lower", "full_body", "cardio", "custom",
            name="day_tag",
            schema="training",
            create_type=False,
        ),
        nullable=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    perceived_difficulty: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)

    logged_exercises: Mapped[list["LoggedExercise"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="LoggedExercise.position",
    )
