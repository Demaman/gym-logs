"""add battle_coefficient to exercises

Revision ID: f1g2h3i4j5k6
Revises: e1f2a3b4c5d6
Create Date: 2026-09-02 00:01:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f1g2h3i4j5k6"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "exercises",
        sa.Column(
            "battle_coefficient",
            sa.Float(),
            nullable=False,
            server_default="1.0",
        ),
        schema="training",
    )


def downgrade() -> None:
    op.drop_column("exercises", "battle_coefficient", schema="training")
