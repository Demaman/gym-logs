"""add_demo_video_url_to_program_exercises

Revision ID: cf24d326d540
Revises: 25fac9d5814f
Create Date: 2026-08-07 00:59:53.708266

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'cf24d326d540'
down_revision: Union[str, None] = '25fac9d5814f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('program_exercises', sa.Column('demo_video_url', sa.String(length=2048), nullable=True), schema='training')


def downgrade() -> None:
    op.drop_column('program_exercises', 'demo_video_url', schema='training')
