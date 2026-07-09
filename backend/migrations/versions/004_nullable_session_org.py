"""logs: make workout_sessions.organization_id nullable for solo athletes

Revision ID: 004
Revises: 003
Create Date: 2026-07-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "004"
down_revision: str | None = "003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "workout_sessions",
        "organization_id",
        existing_type=UUID(as_uuid=True),
        nullable=True,
        schema="logs",
    )


def downgrade() -> None:
    op.alter_column(
        "workout_sessions",
        "organization_id",
        existing_type=UUID(as_uuid=True),
        nullable=False,
        schema="logs",
    )
