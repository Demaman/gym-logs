import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base
from db.constants.logs import SCHEMA


class LoggedExercise(Base):
    __tablename__ = "logged_exercises"
    __table_args__ = (
        CheckConstraint(
            "exercise_id IS NOT NULL OR exercise_name_free IS NOT NULL",
            name="ck_logged_exercise_has_name",
        ),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("logs.workout_sessions.id"),
        nullable=False,
    )
    exercise_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("training.exercises.id"),
        nullable=True,
    )
    exercise_name_free: Mapped[str | None] = mapped_column(String(255), nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    session: Mapped["WorkoutSession"] = relationship(back_populates="logged_exercises")
    logged_sets: Mapped[list["LoggedSet"]] = relationship(
        back_populates="logged_exercise",
        cascade="all, delete-orphan",
        order_by="LoggedSet.position",
    )
