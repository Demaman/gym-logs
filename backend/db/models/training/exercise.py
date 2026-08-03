import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base
from db.constants.training import SCHEMA, Equipment, MovementPattern, MuscleGroup


class Exercise(Base):
    __tablename__ = "exercises"
    __table_args__ = (
        Index("ix_exercise_org_name", "organization_id", "name"),
        Index("ix_exercise_aliases_gin", "aliases", postgresql_using="gin"),
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
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    aliases: Mapped[list] = mapped_column(
        JSONB, nullable=False, server_default="[]"
    )
    muscle_group: Mapped[str] = mapped_column(
        Enum(*MuscleGroup.ALL, name="muscle_group", schema=SCHEMA),
        nullable=False,
    )
    secondary_muscles: Mapped[list] = mapped_column(
        JSONB, nullable=False, server_default="[]"
    )
    equipment: Mapped[str] = mapped_column(
        Enum(*Equipment.ALL, name="equipment", schema=SCHEMA),
        nullable=False,
    )
    movement_pattern: Mapped[str] = mapped_column(
        Enum(*MovementPattern.ALL, name="movement_pattern", schema=SCHEMA),
        nullable=False,
    )
    is_bilateral: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    is_global: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("identity.users.id"),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
