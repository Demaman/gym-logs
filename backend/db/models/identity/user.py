import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base
from db.constants.identity import SCHEMA, Role


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.organizations.id"),
        nullable=True,
        index=True,
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(
        Enum(
            Role.ATHLETE,
            Role.TRAINER,
            Role.GYM_ADMIN,
            name="user_role",
            schema=SCHEMA,
        ),
        nullable=False,
    )
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    organization: Mapped["Organization | None"] = relationship(back_populates="users")
    memberships_as_trainer: Mapped[list["Membership"]] = relationship(
        foreign_keys="Membership.trainer_id", back_populates="trainer"
    )
    memberships_as_athlete: Mapped[list["Membership"]] = relationship(
        foreign_keys="Membership.athlete_id", back_populates="athlete"
    )
