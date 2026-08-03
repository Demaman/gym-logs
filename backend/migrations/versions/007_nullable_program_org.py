"""make program organization_id nullable for solo users

Revision ID: 007
Revises: 006
Create Date: 2026-07-10
"""
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "programs",
        "organization_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
        schema="training",
    )


def downgrade() -> None:
    op.alter_column(
        "programs",
        "organization_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
        schema="training",
    )
