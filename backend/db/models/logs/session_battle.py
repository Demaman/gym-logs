import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base
from db.constants.logs import SCHEMA


class SessionBattle(Base):
    __tablename__ = "session_battles"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    battle_code: Mapped[str] = mapped_column(String(8), nullable=False, unique=True)
    initiator_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("logs.workout_sessions.id"),
        nullable=False,
    )
    opponent_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("logs.workout_sessions.id"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="waiting")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    initiator_session: Mapped["WorkoutSession"] = relationship(  # noqa: F821
        foreign_keys=[initiator_session_id],
    )
    opponent_session: Mapped["WorkoutSession | None"] = relationship(  # noqa: F821
        foreign_keys=[opponent_session_id],
    )
