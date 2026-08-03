"""anamnesis: athlete_profiles and body_measurements

Revision ID: 008
Revises: 007
Create Date: 2026-07-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM, UUID

revision: str = "008"
down_revision: str | None = "007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE analytics.sex_type AS ENUM ('male', 'female', 'other');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE analytics.competition_level_type AS ENUM
                ('recreational', 'amateur', 'competitive', 'elite');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE analytics.goal_type AS ENUM
                ('strength', 'hypertrophy', 'fat_loss', 'endurance', 'sport_performance', 'general_fitness');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE analytics.dominant_side_type AS ENUM ('left', 'right');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE analytics.bf_method_type AS ENUM
                ('dexa', 'skinfold', 'bioimpedance', 'navy_formula', 'visual');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)

    op.create_table(
        "athlete_profiles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("organization_id", UUID(as_uuid=True), nullable=True),
        sa.Column("date_of_birth", sa.Date, nullable=True),
        sa.Column("sex", ENUM(name="sex_type", schema="analytics", create_type=False), nullable=True),
        sa.Column("dominant_side", ENUM(name="dominant_side_type", schema="analytics", create_type=False), nullable=True),
        sa.Column("height_cm", sa.Float, nullable=True),
        sa.Column("training_age_years", sa.Integer, nullable=True),
        sa.Column("training_frequency_available", sa.Integer, nullable=True),
        sa.Column("primary_sport", sa.String(255), nullable=True),
        sa.Column("competition_level", ENUM(name="competition_level_type", schema="analytics", create_type=False), nullable=True),
        sa.Column("primary_goal", ENUM(name="goal_type", schema="analytics", create_type=False), nullable=True),
        sa.Column("target_event_date", sa.Date, nullable=True),
        sa.Column("parq_cleared", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("injury_history", sa.Text, nullable=True),
        sa.Column("surgeries", sa.Text, nullable=True),
        sa.Column("chronic_conditions", sa.Text, nullable=True),
        sa.Column("medications", sa.Text, nullable=True),
        sa.Column("contraindications", sa.Text, nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        schema="analytics",
    )
    op.create_index("ix_athlete_profiles_user_id", "athlete_profiles", ["user_id"], schema="analytics")

    op.create_table(
        "body_measurements",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", UUID(as_uuid=True), nullable=True),
        sa.Column("measured_at", sa.Date, nullable=False),
        sa.Column("weight_kg", sa.Float, nullable=True),
        sa.Column("body_fat_pct", sa.Float, nullable=True),
        sa.Column("lean_mass_kg", sa.Float, nullable=True),
        sa.Column("bf_method", ENUM(name="bf_method_type", schema="analytics", create_type=False), nullable=True),
        sa.Column("waist_cm", sa.Float, nullable=True),
        sa.Column("hip_cm", sa.Float, nullable=True),
        sa.Column("chest_cm", sa.Float, nullable=True),
        sa.Column("upper_arm_cm", sa.Float, nullable=True),
        sa.Column("thigh_cm", sa.Float, nullable=True),
        sa.Column("calf_cm", sa.Float, nullable=True),
        sa.Column("resting_hr", sa.Integer, nullable=True),
        sa.Column("bp_systolic", sa.Integer, nullable=True),
        sa.Column("bp_diastolic", sa.Integer, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        schema="analytics",
    )
    op.create_index("ix_body_measurements_user_id", "body_measurements", ["user_id"], schema="analytics")
    op.create_index(
        "ix_body_measurements_user_date", "body_measurements",
        ["user_id", "measured_at"], schema="analytics",
    )


def downgrade() -> None:
    op.drop_table("body_measurements", schema="analytics")
    op.drop_table("athlete_profiles", schema="analytics")
    op.execute("DROP TYPE IF EXISTS analytics.bf_method_type")
    op.execute("DROP TYPE IF EXISTS analytics.dominant_side_type")
    op.execute("DROP TYPE IF EXISTS analytics.goal_type")
    op.execute("DROP TYPE IF EXISTS analytics.competition_level_type")
    op.execute("DROP TYPE IF EXISTS analytics.sex_type")
