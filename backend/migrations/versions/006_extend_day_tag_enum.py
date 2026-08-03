"""extend day_tag enum with muscle-group specific tags

Revision ID: 006
Revises: 005
Create Date: 2026-07-09
"""
from alembic import op

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None

_NEW_VALUES = ("chest", "back", "shoulders", "arms", "glutes", "core")


def upgrade() -> None:
    for val in _NEW_VALUES:
        op.execute(f"ALTER TYPE training.day_tag ADD VALUE IF NOT EXISTS '{val}'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values without recreating the type.
    pass
