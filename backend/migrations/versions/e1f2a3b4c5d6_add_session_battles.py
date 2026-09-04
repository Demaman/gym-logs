"""add session_battles table

Revision ID: e1f2a3b4c5d6
Revises: db573847af55
Create Date: 2026-09-02 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "session_battles",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("battle_code", sa.String(8), nullable=False),
        sa.Column(
            "initiator_session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("logs.workout_sessions.id"),
            nullable=False,
        ),
        sa.Column(
            "opponent_session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("logs.workout_sessions.id"),
            nullable=True,
        ),
        sa.Column("status", sa.String(16), nullable=False, server_default="waiting"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("battle_code", name="uq_session_battles_code"),
        schema="logs",
    )
    op.create_index(
        "ix_session_battles_initiator",
        "session_battles",
        ["initiator_session_id"],
        schema="logs",
    )
    op.create_index(
        "ix_session_battles_opponent",
        "session_battles",
        ["opponent_session_id"],
        schema="logs",
    )


def downgrade() -> None:
    op.drop_index("ix_session_battles_opponent", table_name="session_battles", schema="logs")
    op.drop_index("ix_session_battles_initiator", table_name="session_battles", schema="logs")
    op.drop_table("session_battles", schema="logs")
