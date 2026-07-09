import uuid

from sqlalchemy import Enum, Float, ForeignKey, Integer, SmallInteger, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base
from db.constants.training import SCHEMA, SetType


class PrescribedSet(Base):
    __tablename__ = "prescribed_sets"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    program_exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.program_exercises.id"),
        nullable=False,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    set_type: Mapped[str] = mapped_column(
        Enum(*SetType.ALL, name="set_type", schema=SCHEMA),
        nullable=False,
        default=SetType.WORKING,
    )
    rep_min: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=8)
    rep_max: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=12)
    rpe_target: Mapped[float | None] = mapped_column(Float, nullable=True)
    rest_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weight_pct_1rm: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    program_exercise: Mapped["ProgramExercise"] = relationship(
        back_populates="prescribed_sets"
    )
