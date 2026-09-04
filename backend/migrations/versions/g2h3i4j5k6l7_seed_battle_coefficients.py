"""seed battle_coefficient for global exercises

Revision ID: g2h3i4j5k6l7
Revises: f1g2h3i4j5k6
Create Date: 2026-09-02 00:02:00.000000

Coefficients normalise raw volume across exercises so that a leg-press
athlete doesn't score 3× a squatter just because machines allow heavier loads.
Formula: score = Σ(weight_kg × reps × coeff) / body_weight^0.667

Reference exercise: barbell back squat = 1.0.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "g2h3i4j5k6l7"
down_revision: Union[str, None] = "f1g2h3i4j5k6"
branch_labels = None
depends_on = None

# (name, equipment, coefficient)
_COEFFICIENTS: list[tuple[str, str, float]] = [
    # ── Full body / reference ──────────────────────────────────────
    ("Deadlift",                    "barbell",    1.00),
    ("Power Clean",                 "barbell",    1.10),
    ("Kettlebell Swing",            "kettlebell", 0.90),
    # ── Quads ──────────────────────────────────────────────────────
    ("Squat",                       "barbell",    1.00),
    ("Front Squat",                 "barbell",    0.90),
    ("Leg Press",                   "machine",    0.33),
    ("Hack Squat",                  "machine",    0.50),
    ("Leg Extension",               "machine",    0.45),
    ("Bulgarian Split Squat",       "dumbbell",   0.85),
    ("Goblet Squat",                "kettlebell", 0.85),
    ("Walking Lunges",              "dumbbell",   0.80),
    # ── Hamstrings ─────────────────────────────────────────────────
    ("Romanian Deadlift",           "barbell",    0.90),
    ("Romanian Deadlift",           "dumbbell",   0.80),
    ("Stiff-Leg Deadlift",          "barbell",    0.90),
    ("Leg Curl",                    "machine",    0.45),
    ("Nordic Curl",                 "bodyweight", 1.20),
    # ── Glutes ─────────────────────────────────────────────────────
    ("Hip Thrust",                  "barbell",    0.80),
    ("Glute Bridge",                "bodyweight", 1.00),
    ("Cable Kickback",              "cable",      0.50),
    # ── Calves ─────────────────────────────────────────────────────
    ("Calf Press",                  "machine",    0.40),
    ("Seated Calf Raise",           "machine",    0.50),
    ("Standing Calf Raise",         "machine",    0.45),
    # ── Chest ──────────────────────────────────────────────────────
    ("Bench Press",                 "barbell",    0.75),
    ("Bench Press",                 "dumbbell",   0.70),
    ("Incline Bench Press",         "barbell",    0.70),
    ("Incline Bench Press",         "dumbbell",   0.65),
    ("Decline Bench Press",         "barbell",    0.70),
    ("Push-up",                     "bodyweight", 0.90),
    ("Dips",                        "bodyweight", 0.85),
    ("Cable Crossover",             "cable",      0.55),
    ("Chest Fly",                   "machine",    0.55),
    ("Pec Deck",                    "machine",    0.50),
    # ── Back ───────────────────────────────────────────────────────
    ("Barbell Row",                 "barbell",    0.65),
    ("T-Bar Row",                   "barbell",    0.65),
    ("Chest-Supported Row",         "machine",    0.55),
    ("Dumbbell Row",                "dumbbell",   0.60),
    ("Seated Cable Row",            "cable",      0.55),
    ("Lat Pulldown",                "cable",      0.55),
    ("Pull-up",                     "bodyweight", 0.85),
    ("Chin-up",                     "bodyweight", 0.85),
    ("Rear Delt Fly",               "dumbbell",   0.45),
    # ── Shoulders ──────────────────────────────────────────────────
    ("Overhead Press",              "barbell",    0.55),
    ("Overhead Press",              "dumbbell",   0.50),
    ("Arnold Press",                "dumbbell",   0.50),
    ("Seated Overhead Press",       "machine",    0.45),
    ("Lateral Raise",               "dumbbell",   0.40),
    ("Lateral Raise",               "cable",      0.40),
    ("Front Raise",                 "dumbbell",   0.40),
    ("Face Pull",                   "cable",      0.40),
    # ── Biceps ─────────────────────────────────────────────────────
    ("Barbell Curl",                "barbell",    0.35),
    ("Preacher Curl",               "barbell",    0.35),
    ("Dumbbell Curl",               "dumbbell",   0.30),
    ("Hammer Curl",                 "dumbbell",   0.30),
    ("Concentration Curl",          "dumbbell",   0.30),
    ("Incline Dumbbell Curl",       "dumbbell",   0.30),
    ("Cable Curl",                  "cable",      0.30),
    # ── Triceps ────────────────────────────────────────────────────
    ("Close-Grip Bench Press",      "barbell",    0.65),
    ("Skull Crushers",              "barbell",    0.40),
    ("Overhead Tricep Extension",   "dumbbell",   0.35),
    ("Tricep Pushdown",             "cable",      0.35),
    ("Tricep Kickback",             "dumbbell",   0.30),
    # ── Core ───────────────────────────────────────────────────────
    ("Ab Wheel Rollout",            "other",      1.00),
    ("Hanging Leg Raise",           "bodyweight", 0.90),
    ("Plank",                       "bodyweight", 1.00),
    ("Crunch",                      "bodyweight", 0.80),
    ("Russian Twist",               "bodyweight", 0.80),
    ("Cable Crunch",                "cable",      0.40),
]


def upgrade() -> None:
    for name, equipment, coeff in _COEFFICIENTS:
        op.execute(
            f"UPDATE training.exercises "
            f"SET battle_coefficient = {coeff} "
            f"WHERE is_global = true "
            f"AND name = '{name}' "
            f"AND equipment = '{equipment}'"
        )


def downgrade() -> None:
    op.execute(
        "UPDATE training.exercises SET battle_coefficient = 1.0 WHERE is_global = true"
    )
