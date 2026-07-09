"""training and logs: exercise catalog, programs, workout sessions, set logging

Revision ID: 003
Revises: 002
Create Date: 2026-07-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "003"
down_revision: str | None = "002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── training.exercises ────────────────────────────────────────────────────
    op.create_table(
        "exercises",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("aliases", JSONB, nullable=False, server_default="[]"),
        sa.Column(
            "muscle_group",
            sa.Enum(
                "chest","back","shoulders","biceps","triceps","forearms",
                "core","quads","hamstrings","glutes","calves","full_body",
                name="muscle_group", schema="training",
            ),
            nullable=False,
        ),
        sa.Column("secondary_muscles", JSONB, nullable=False, server_default="[]"),
        sa.Column(
            "equipment",
            sa.Enum(
                "barbell","dumbbell","machine","cable","bodyweight",
                "kettlebell","bands","other",
                name="equipment", schema="training",
            ),
            nullable=False,
        ),
        sa.Column(
            "movement_pattern",
            sa.Enum(
                "push","pull","squat","hinge","carry","rotation","isolation",
                name="movement_pattern", schema="training",
            ),
            nullable=False,
        ),
        sa.Column("is_bilateral", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("is_global", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_by_id", UUID(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["identity.organizations.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["identity.users.id"]),
        schema="training",
    )
    op.create_index("ix_exercise_org_name", "exercises", ["organization_id", "name"], schema="training")
    op.create_index("ix_exercise_org", "exercises", ["organization_id"], schema="training")
    op.create_index("ix_exercise_aliases_gin", "exercises", ["aliases"], schema="training", postgresql_using="gin")

    # ── training.programs ─────────────────────────────────────────────────────
    op.create_table(
        "programs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", UUID(as_uuid=True), nullable=False),
        sa.Column("athlete_id", UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "mode",
            sa.Enum("on_the_fly","program_driven", name="session_mode", schema="training"),
            nullable=False,
            server_default="on_the_fly",
        ),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_by_id", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["identity.organizations.id"]),
        sa.ForeignKeyConstraint(["athlete_id"], ["identity.users.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["identity.users.id"]),
        schema="training",
    )
    op.create_index("ix_program_org", "programs", ["organization_id"], schema="training")
    op.create_index("ix_program_athlete", "programs", ["athlete_id"], schema="training")

    # ── training.program_days ─────────────────────────────────────────────────
    op.create_table(
        "program_days",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("program_id", UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column(
            "day_tag",
            sa.Enum(
                "push","pull","legs","upper","lower","full_body","cardio","custom",
                name="day_tag", schema="training",
            ),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["program_id"], ["training.programs.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("program_id", "position", name="uq_program_day_position"),
        schema="training",
    )

    # ── training.program_exercises ────────────────────────────────────────────
    op.create_table(
        "program_exercises",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("program_day_id", UUID(as_uuid=True), nullable=False),
        sa.Column("exercise_id", UUID(as_uuid=True), nullable=False),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.ForeignKeyConstraint(["program_day_id"], ["training.program_days.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exercise_id"], ["training.exercises.id"]),
        sa.UniqueConstraint("program_day_id", "position", name="uq_program_exercise_position"),
        schema="training",
    )

    # ── training.prescribed_sets ──────────────────────────────────────────────
    op.create_table(
        "prescribed_sets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("program_exercise_id", UUID(as_uuid=True), nullable=False),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column(
            "set_type",
            sa.Enum(
                "warm_up","feeder","working","back_off","top_set","failure",
                "drop_set","rest_pause","cluster","burnout","technique","deload",
                name="set_type", schema="training",
            ),
            nullable=False,
            server_default="working",
        ),
        sa.Column("rep_min", sa.SmallInteger, nullable=False, server_default="8"),
        sa.Column("rep_max", sa.SmallInteger, nullable=False, server_default="12"),
        sa.Column("rpe_target", sa.Float, nullable=True),
        sa.Column("rest_seconds", sa.Integer, nullable=True),
        sa.Column("weight_pct_1rm", sa.Float, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.ForeignKeyConstraint(["program_exercise_id"], ["training.program_exercises.id"], ondelete="CASCADE"),
        schema="training",
    )

    # ── logs.workout_sessions ─────────────────────────────────────────────────
    op.create_table(
        "workout_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", UUID(as_uuid=True), nullable=False),
        sa.Column("athlete_id", UUID(as_uuid=True), nullable=False),
        sa.Column("program_day_id", UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "mode",
            # session_mode already created by training.programs above — reuse it
            sa.Enum("on_the_fly","program_driven", name="session_mode", schema="training", create_type=False),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("perceived_difficulty", sa.SmallInteger, nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["identity.organizations.id"]),
        sa.ForeignKeyConstraint(["athlete_id"], ["identity.users.id"]),
        sa.ForeignKeyConstraint(["program_day_id"], ["training.program_days.id"]),
        schema="logs",
    )
    op.create_index(
        "ix_session_athlete_started",
        "workout_sessions",
        ["organization_id", "athlete_id", "started_at"],
        schema="logs",
    )

    # ── logs.logged_exercises ─────────────────────────────────────────────────
    op.create_table(
        "logged_exercises",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", UUID(as_uuid=True), nullable=False),
        sa.Column("exercise_id", UUID(as_uuid=True), nullable=True),
        sa.Column("exercise_name_free", sa.String(255), nullable=True),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.ForeignKeyConstraint(["session_id"], ["logs.workout_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exercise_id"], ["training.exercises.id"]),
        sa.CheckConstraint(
            "exercise_id IS NOT NULL OR exercise_name_free IS NOT NULL",
            name="ck_logged_exercise_has_name",
        ),
        schema="logs",
    )

    # ── logs.logged_sets ──────────────────────────────────────────────────────
    op.create_table(
        "logged_sets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("logged_exercise_id", UUID(as_uuid=True), nullable=False),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column(
            "set_type",
            # set_type already created by training.prescribed_sets above — reuse it
            sa.Enum(
                "warm_up","feeder","working","back_off","top_set","failure",
                "drop_set","rest_pause","cluster","burnout","technique","deload",
                name="set_type", schema="training", create_type=False,
            ),
            nullable=False,
            server_default="working",
        ),
        sa.Column("weight_kg", sa.Float, nullable=False),
        sa.Column("reps", sa.SmallInteger, nullable=False),
        sa.Column("rpe", sa.Float, nullable=True),
        sa.Column("rir", sa.SmallInteger, nullable=True),
        sa.Column("is_to_failure", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("counts_volume", sa.Boolean, nullable=False),
        sa.Column("tempo", sa.String(10), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["logged_exercise_id"], ["logs.logged_exercises.id"], ondelete="CASCADE"),
        schema="logs",
    )
    op.create_index(
        "ix_logged_set_exercise_pos",
        "logged_sets",
        ["logged_exercise_id", "position"],
        schema="logs",
    )


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_index("ix_logged_set_exercise_pos", table_name="logged_sets", schema="logs")
    op.drop_table("logged_sets", schema="logs")
    op.drop_table("logged_exercises", schema="logs")
    op.drop_index("ix_session_athlete_started", table_name="workout_sessions", schema="logs")
    op.drop_table("workout_sessions", schema="logs")

    op.drop_table("prescribed_sets", schema="training")
    op.drop_table("program_exercises", schema="training")
    op.drop_table("program_days", schema="training")
    op.drop_index("ix_program_athlete", table_name="programs", schema="training")
    op.drop_index("ix_program_org", table_name="programs", schema="training")
    op.drop_table("programs", schema="training")
    op.drop_index("ix_exercise_aliases_gin", table_name="exercises", schema="training")
    op.drop_index("ix_exercise_org", table_name="exercises", schema="training")
    op.drop_index("ix_exercise_org_name", table_name="exercises", schema="training")
    op.drop_table("exercises", schema="training")
    # Enums owned by training schema — set_type and session_mode drop with their first table
    # muscle_group, equipment, movement_pattern, day_tag drop with exercises and program_days
