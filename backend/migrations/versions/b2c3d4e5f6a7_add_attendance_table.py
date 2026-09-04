"""add attendance table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-25 01:00:00.000000

"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "attendance",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("identity.organizations.id"),
            nullable=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("identity.users.id"),
            nullable=False,
        ),
        sa.Column(
            "checked_in_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("source", sa.String(32), nullable=False, server_default="session_log"),
        schema="logs",
    )
    op.create_index(
        "ix_logs_attendance_organization_id",
        "attendance",
        ["organization_id"],
        schema="logs",
    )
    op.create_index(
        "ix_logs_attendance_user_id",
        "attendance",
        ["user_id"],
        schema="logs",
    )
    op.create_index(
        "ix_logs_attendance_checked_in_at",
        "attendance",
        ["checked_in_at"],
        schema="logs",
    )


def downgrade() -> None:
    op.drop_index("ix_logs_attendance_checked_in_at", table_name="attendance", schema="logs")
    op.drop_index("ix_logs_attendance_user_id", table_name="attendance", schema="logs")
    op.drop_index("ix_logs_attendance_organization_id", table_name="attendance", schema="logs")
    op.drop_table("attendance", schema="logs")
