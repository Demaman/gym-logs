import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base
from db.constants.logs import SCHEMA


class LoggedSet(Base):
    __tablename__ = "logged_sets"
    __table_args__ = (
        Index("ix_logged_set_exercise_pos", "logged_exercise_id", "position"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    logged_exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("logs.logged_exercises.id"),
        nullable=False,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    set_type: Mapped[str] = mapped_column(
        Enum(
            "warm_up",
            "feeder",
            "working",
            "back_off",
            "top_set",
            "failure",
            "drop_set",
            "rest_pause",
            "cluster",
            "burnout",
            "technique",
            "deload",
            name="set_type",
            schema="training",
            create_type=False,
        ),
        nullable=False,
        default="working",
    )
    weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    reps: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    rpe: Mapped[float | None] = mapped_column(Float, nullable=True)
    rir: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    is_to_failure: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    counts_volume: Mapped[bool] = mapped_column(Boolean, nullable=False)
    tempo: Mapped[str | None] = mapped_column(String(10), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    logged_exercise: Mapped["LoggedExercise"] = relationship(back_populates="logged_sets")
