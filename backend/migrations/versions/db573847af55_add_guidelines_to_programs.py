"""add guidelines to programs

Revision ID: db573847af55
Revises: d5011bbf9670
Create Date: 2026-08-04 22:15:27.857546

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'db573847af55'
down_revision: Union[str, None] = 'd5011bbf9670'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('programs', sa.Column('guidelines', sa.Text(), nullable=True), schema='training')


def downgrade() -> None:
    op.drop_column('programs', 'guidelines', schema='training')
    op.create_table('body_measurements',
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('user_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('organization_id', sa.UUID(), autoincrement=False, nullable=True),
    sa.Column('measured_at', sa.DATE(), autoincrement=False, nullable=False),
    sa.Column('weight_kg', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('body_fat_pct', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('lean_mass_kg', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('bf_method', postgresql.ENUM('dexa', 'skinfold', 'bioimpedance', 'navy_formula', 'visual', name='bf_method_type', schema='analytics'), autoincrement=False, nullable=True),
    sa.Column('waist_cm', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('hip_cm', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('chest_cm', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('upper_arm_cm', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('thigh_cm', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('calf_cm', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('resting_hr', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('bp_systolic', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('bp_diastolic', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('notes', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('body_measurements_pkey')),
    schema='analytics'
    )
    op.create_index(op.f('ix_body_measurements_user_id'), 'body_measurements', ['user_id'], unique=False, schema='analytics')
    op.create_index(op.f('ix_body_measurements_user_date'), 'body_measurements', ['user_id', 'measured_at'], unique=False, schema='analytics')
    op.create_table('athlete_profiles',
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('user_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('organization_id', sa.UUID(), autoincrement=False, nullable=True),
    sa.Column('date_of_birth', sa.DATE(), autoincrement=False, nullable=True),
    sa.Column('sex', postgresql.ENUM('male', 'female', 'other', name='sex_type', schema='analytics'), autoincrement=False, nullable=True),
    sa.Column('dominant_side', postgresql.ENUM('left', 'right', name='dominant_side_type', schema='analytics'), autoincrement=False, nullable=True),
    sa.Column('height_cm', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('training_age_years', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('training_frequency_available', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('primary_sport', sa.VARCHAR(length=255), autoincrement=False, nullable=True),
    sa.Column('competition_level', postgresql.ENUM('recreational', 'amateur', 'competitive', 'elite', name='competition_level_type', schema='analytics'), autoincrement=False, nullable=True),
    sa.Column('primary_goal', postgresql.ENUM('strength', 'hypertrophy', 'fat_loss', 'endurance', 'sport_performance', 'general_fitness', name='goal_type', schema='analytics'), autoincrement=False, nullable=True),
    sa.Column('target_event_date', sa.DATE(), autoincrement=False, nullable=True),
    sa.Column('parq_cleared', sa.BOOLEAN(), server_default=sa.text('false'), autoincrement=False, nullable=False),
    sa.Column('injury_history', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('surgeries', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('chronic_conditions', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('medications', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('contraindications', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('athlete_profiles_pkey')),
    sa.UniqueConstraint('user_id', name=op.f('athlete_profiles_user_id_key'), postgresql_include=[], postgresql_nulls_not_distinct=False),
    schema='analytics'
    )
