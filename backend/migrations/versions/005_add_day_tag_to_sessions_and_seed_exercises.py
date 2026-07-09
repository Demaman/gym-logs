"""logs: add day_tag to workout_sessions; seed global exercise catalog

Revision ID: 005
Revises: 004
Create Date: 2026-07-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "005"
down_revision: str | None = "004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# ---------------------------------------------------------------------------
# Seed data — global exercises (is_global = TRUE, organization_id = NULL)
# muscle_group values must match the training.muscle_group enum
# equipment values must match the training.equipment enum
# movement_pattern values must match the training.movement_pattern enum
# ---------------------------------------------------------------------------

_EXERCISES = [
    # ── CHEST (push) ─────────────────────────────────────────────────────────
    ("Bench Press",              "chest",      "barbell",    "push",      True),
    ("Bench Press",              "chest",      "dumbbell",   "push",      True),
    ("Incline Bench Press",      "chest",      "barbell",    "push",      True),
    ("Incline Bench Press",      "chest",      "dumbbell",   "push",      True),
    ("Decline Bench Press",      "chest",      "barbell",    "push",      True),
    ("Cable Crossover",          "chest",      "cable",      "push",      False),
    ("Chest Fly",                "chest",      "machine",    "push",      True),
    ("Pec Deck",                 "chest",      "machine",    "isolation", True),
    ("Push-up",                  "chest",      "bodyweight", "push",      True),
    ("Dips",                     "chest",      "bodyweight", "push",      True),
    # ── SHOULDERS (push) ─────────────────────────────────────────────────────
    ("Overhead Press",           "shoulders",  "barbell",    "push",      True),
    ("Overhead Press",           "shoulders",  "dumbbell",   "push",      True),
    ("Arnold Press",             "shoulders",  "dumbbell",   "push",      True),
    ("Lateral Raise",            "shoulders",  "dumbbell",   "isolation", True),
    ("Lateral Raise",            "shoulders",  "cable",      "isolation", False),
    ("Front Raise",              "shoulders",  "dumbbell",   "isolation", True),
    ("Face Pull",                "shoulders",  "cable",      "pull",      True),
    ("Seated Overhead Press",    "shoulders",  "machine",    "push",      True),
    # ── TRICEPS (push) ───────────────────────────────────────────────────────
    ("Tricep Pushdown",          "triceps",    "cable",      "push",      True),
    ("Skull Crushers",           "triceps",    "barbell",    "push",      True),
    ("Close-Grip Bench Press",   "triceps",    "barbell",    "push",      True),
    ("Overhead Tricep Extension","triceps",    "dumbbell",   "push",      True),
    ("Tricep Kickback",          "triceps",    "dumbbell",   "isolation", False),
    # ── BACK (pull) ──────────────────────────────────────────────────────────
    ("Pull-up",                  "back",       "bodyweight", "pull",      True),
    ("Chin-up",                  "back",       "bodyweight", "pull",      True),
    ("Lat Pulldown",             "back",       "cable",      "pull",      True),
    ("Seated Cable Row",         "back",       "cable",      "pull",      True),
    ("Barbell Row",              "back",       "barbell",    "pull",      True),
    ("Dumbbell Row",             "back",       "dumbbell",   "pull",      False),
    ("T-Bar Row",                "back",       "barbell",    "pull",      True),
    ("Chest-Supported Row",      "back",       "machine",    "pull",      True),
    ("Rear Delt Fly",            "back",       "dumbbell",   "pull",      True),
    # ── BICEPS (pull) ────────────────────────────────────────────────────────
    ("Barbell Curl",             "biceps",     "barbell",    "pull",      True),
    ("Dumbbell Curl",            "biceps",     "dumbbell",   "pull",      True),
    ("Hammer Curl",              "biceps",     "dumbbell",   "isolation", True),
    ("Preacher Curl",            "biceps",     "barbell",    "isolation", True),
    ("Cable Curl",               "biceps",     "cable",      "isolation", True),
    ("Incline Dumbbell Curl",    "biceps",     "dumbbell",   "isolation", True),
    ("Concentration Curl",       "biceps",     "dumbbell",   "isolation", False),
    # ── QUADS (legs) ─────────────────────────────────────────────────────────
    ("Squat",                    "quads",      "barbell",    "squat",     True),
    ("Front Squat",              "quads",      "barbell",    "squat",     True),
    ("Hack Squat",               "quads",      "machine",    "squat",     True),
    ("Leg Press",                "quads",      "machine",    "squat",     True),
    ("Leg Extension",            "quads",      "machine",    "isolation", True),
    ("Bulgarian Split Squat",    "quads",      "dumbbell",   "squat",     False),
    ("Goblet Squat",             "quads",      "kettlebell", "squat",     True),
    ("Walking Lunges",           "quads",      "dumbbell",   "squat",     False),
    # ── HAMSTRINGS (legs) ────────────────────────────────────────────────────
    ("Romanian Deadlift",        "hamstrings", "barbell",    "hinge",     True),
    ("Romanian Deadlift",        "hamstrings", "dumbbell",   "hinge",     True),
    ("Leg Curl",                 "hamstrings", "machine",    "isolation", True),
    ("Nordic Curl",              "hamstrings", "bodyweight", "hinge",     True),
    ("Stiff-Leg Deadlift",       "hamstrings", "barbell",    "hinge",     True),
    # ── GLUTES (legs) ────────────────────────────────────────────────────────
    ("Hip Thrust",               "glutes",     "barbell",    "hinge",     True),
    ("Glute Bridge",             "glutes",     "bodyweight", "hinge",     True),
    ("Cable Kickback",           "glutes",     "cable",      "isolation", False),
    # ── CALVES (legs) ────────────────────────────────────────────────────────
    ("Standing Calf Raise",      "calves",     "machine",    "isolation", True),
    ("Seated Calf Raise",        "calves",     "machine",    "isolation", True),
    ("Calf Press",               "calves",     "machine",    "isolation", True),
    # ── FULL BODY / HINGE ────────────────────────────────────────────────────
    ("Deadlift",                 "full_body",  "barbell",    "hinge",     True),
    ("Power Clean",              "full_body",  "barbell",    "carry",     True),
    ("Kettlebell Swing",         "full_body",  "kettlebell", "hinge",     True),
    # ── CORE ─────────────────────────────────────────────────────────────────
    ("Plank",                    "core",       "bodyweight", "carry",     True),
    ("Ab Wheel Rollout",         "core",       "other",      "rotation",  True),
    ("Cable Crunch",             "core",       "cable",      "isolation", True),
    ("Hanging Leg Raise",        "core",       "bodyweight", "rotation",  True),
    ("Russian Twist",            "core",       "bodyweight", "rotation",  True),
    ("Crunch",                   "core",       "bodyweight", "isolation", True),
]


def upgrade() -> None:
    # ── DDL: add day_tag to workout_sessions ─────────────────────────────────
    op.add_column(
        "workout_sessions",
        sa.Column(
            "day_tag",
            sa.Enum(
                "push", "pull", "legs", "upper", "lower",
                "full_body", "cardio", "custom",
                name="day_tag",
                schema="training",
                create_type=False,
            ),
            nullable=True,
        ),
        schema="logs",
    )

    # ── DML: seed global exercises ────────────────────────────────────────────
    # Values are embedded directly (no user input) to avoid ::type_cast vs
    # named-param ambiguity with the asyncpg driver.
    rows = ", ".join(
        "(gen_random_uuid(), '{name}', '[]'::jsonb,"
        " '{mg}'::training.muscle_group, '[]'::jsonb,"
        " '{eq}'::training.equipment, '{mp}'::training.movement_pattern,"
        " {bil}, TRUE, now())".format(
            name=name.replace("'", "''"),
            mg=muscle_group,
            eq=equipment,
            mp=movement_pattern,
            bil="TRUE" if is_bilateral else "FALSE",
        )
        for name, muscle_group, equipment, movement_pattern, is_bilateral in _EXERCISES
    )
    op.execute(
        "INSERT INTO training.exercises "
        "(id, name, aliases, muscle_group, secondary_muscles, equipment, "
        " movement_pattern, is_bilateral, is_global, created_at) "
        f"VALUES {rows} ON CONFLICT DO NOTHING"
    )


def downgrade() -> None:
    op.drop_column("workout_sessions", "day_tag", schema="logs")
    op.execute("DELETE FROM training.exercises WHERE is_global = TRUE")
