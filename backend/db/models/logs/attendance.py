import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from db.constants.logs import SCHEMA
from db.constants.identity import SCHEMA as IDENTITY_SCHEMA
from core.database import Base


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{IDENTITY_SCHEMA}.organizations.id"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{IDENTITY_SCHEMA}.users.id"),
        nullable=False,
        index=True,
    )
    checked_in_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    source: Mapped[str] = mapped_column(
        String(32), nullable=False, default="session_log"
    )
    external_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
