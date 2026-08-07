"""add_demo_video_url_to_exercises

Revision ID: 25fac9d5814f
Revises: db573847af55
Create Date: 2026-08-06 20:05:17.151115

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '25fac9d5814f'
down_revision: Union[str, None] = 'db573847af55'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'exercises',
        sa.Column('demo_video_url', sa.String(length=2048), nullable=True),
        schema='training',
    )


def downgrade() -> None:
    op.drop_column('exercises', 'demo_video_url', schema='training')
