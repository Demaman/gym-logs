"""identity: make organization_id nullable on users and memberships

Revision ID: 002
Revises: 001
Create Date: 2026-06-30

Solo athletes and independent trainers must be able to use the platform without
belonging to an organization. organization_id is nullable on both tables; a NULL
value means "independent / no organization". The FK constraint is retained so that
when a value is present it must reference a valid organization.
"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "002"
down_revision: str | None = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "organization_id",
        existing_type=UUID(as_uuid=True),
        nullable=True,
        schema="identity",
    )
    op.alter_column(
        "memberships",
        "organization_id",
        existing_type=UUID(as_uuid=True),
        nullable=True,
        schema="identity",
    )


def downgrade() -> None:
    # WARNING: will fail if any row has organization_id = NULL.
    op.alter_column(
        "memberships",
        "organization_id",
        existing_type=UUID(as_uuid=True),
        nullable=False,
        schema="identity",
    )
    op.alter_column(
        "users",
        "organization_id",
        existing_type=UUID(as_uuid=True),
        nullable=False,
        schema="identity",
    )
