"""recalibrate battle coefficients for competitive parity

Revision ID: h3i4j5k6l7m8
Revises: g2h3i4j5k6l7
Create Date: 2026-09-02 01:00:00.000000

Original coefficients penalised upper-body exercises the same way machines are
penalised — which is wrong. Machines can carry 3× the load of a barbell squat
due to mechanical advantage, so 0.33 is correct for Leg Press. But bench press
uses smaller muscles and therefore naturally carries less weight than a squat;
penalising it further means any upper-body training day loses by default.

Corrected principle:
  coefficient = reference_strength / exercise_typical_strength_ratio
  i.e. exercises where you naturally lift LESS get a HIGHER coefficient.

Reference: barbell back squat = 1.0 (unchanged)
  Bench Press ≈ 70% of squat  → 1/0.70 = 1.40
  OHP         ≈ 55% of squat  → 1/0.55 = 1.80
  Rows        ≈ 72% of squat  → 1/0.72 = 1.40
  Isolation (curls, raises)    → capped at 2.50 to prevent inflation
  Machines                     → remain ≤ 0.65 (unchanged)
"""
from typing import Sequence, Union

from alembic import op

revision: str = "h3i4j5k6l7m8"
down_revision: Union[str, None] = "g2h3i4j5k6l7"
branch_labels = None
depends_on = None

# (name, equipment, new_coefficient)
_UPDATES: list[tuple[str, str, float]] = [
    # ── Chest ─────────────────────────────────────────────────────────────────
    # Bench ≈ 70% of squat → 1/0.70 ≈ 1.40
    ("Bench Press",           "barbell",    1.40),
    ("Bench Press",           "dumbbell",   1.50),  # dumbbells allow slightly less
    ("Incline Bench Press",   "barbell",    1.40),
    ("Incline Bench Press",   "dumbbell",   1.50),
    ("Decline Bench Press",   "barbell",    1.35),
    ("Push-up",               "bodyweight", 1.60),
    ("Dips",                  "bodyweight", 1.50),
    ("Cable Crossover",       "cable",      1.20),  # cable isolation, still upper body
    ("Chest Fly",             "machine",    0.55),  # machine — stay low
    ("Pec Deck",              "machine",    0.50),  # machine — stay low

    # ── Back ──────────────────────────────────────────────────────────────────
    # Rows ≈ 72% of squat → ~1.40
    ("Barbell Row",           "barbell",    1.40),
    ("T-Bar Row",             "barbell",    1.35),
    ("Chest-Supported Row",   "machine",    0.60),  # machine — stay low
    ("Dumbbell Row",          "dumbbell",   1.40),
    ("Seated Cable Row",      "cable",      1.20),
    ("Lat Pulldown",          "cable",      1.20),
    ("Pull-up",               "bodyweight", 1.60),
    ("Chin-up",               "bodyweight", 1.60),
    ("Rear Delt Fly",         "dumbbell",   2.20),  # very light isolation

    # ── Shoulders ─────────────────────────────────────────────────────────────
    # OHP ≈ 55% of squat → 1/0.55 ≈ 1.80
    ("Overhead Press",        "barbell",    1.80),
    ("Overhead Press",        "dumbbell",   1.90),
    ("Arnold Press",          "dumbbell",   1.90),
    ("Seated Overhead Press", "machine",    0.55),  # machine — stay low
    ("Lateral Raise",         "dumbbell",   2.50),  # very light isolation
    ("Lateral Raise",         "cable",      2.50),
    ("Front Raise",           "dumbbell",   2.50),
    ("Face Pull",             "cable",      2.00),

    # ── Biceps ────────────────────────────────────────────────────────────────
    # Curls ≈ 25% of squat → cap at 2.50 to avoid score inflation
    ("Barbell Curl",          "barbell",    2.20),
    ("Preacher Curl",         "barbell",    2.20),
    ("Dumbbell Curl",         "dumbbell",   2.40),
    ("Hammer Curl",           "dumbbell",   2.40),
    ("Concentration Curl",    "dumbbell",   2.50),
    ("Incline Dumbbell Curl", "dumbbell",   2.50),
    ("Cable Curl",            "cable",      2.20),

    # ── Triceps ───────────────────────────────────────────────────────────────
    ("Close-Grip Bench Press","barbell",    1.50),  # compound, close to bench
    ("Skull Crushers",        "barbell",    2.00),
    ("Overhead Tricep Extension","dumbbell",2.20),
    ("Tricep Pushdown",       "cable",      2.00),
    ("Tricep Kickback",       "dumbbell",   2.50),

    # ── Lower body — minor recalibrations ────────────────────────────────────
    # Deadlift slightly above squat on average → mild reduction
    ("Deadlift",              "barbell",    0.90),
    # Unilateral/split movements load slightly less total → small boost
    ("Bulgarian Split Squat", "dumbbell",   1.10),
    ("Walking Lunges",        "dumbbell",   1.10),
    # Hip thrust 1RM ≈ squat 1RM for most athletes
    ("Hip Thrust",            "barbell",    1.00),
    # Goblet/Goblet squats limited by dumbbell size
    ("Goblet Squat",          "kettlebell", 1.00),
    # Romanian DL — free weight, similar muscle mass to squat
    ("Romanian Deadlift",     "barbell",    1.00),
    ("Romanian Deadlift",     "dumbbell",   1.10),
    ("Stiff-Leg Deadlift",    "barbell",    1.00),
    # Front squat ≈ 85% of back squat
    ("Front Squat",           "barbell",    1.00),
]


def upgrade() -> None:
    for name, equipment, coeff in _UPDATES:
        op.execute(
            f"UPDATE training.exercises "
            f"SET battle_coefficient = {coeff} "
            f"WHERE is_global = true "
            f"AND name = '{name}' "
            f"AND equipment = '{equipment}'"
        )


def downgrade() -> None:
    # Restore the previous g2h3i4j5k6l7 values
    _PREV: list[tuple[str, str, float]] = [
        ("Bench Press",           "barbell",    0.75),
        ("Bench Press",           "dumbbell",   0.70),
        ("Incline Bench Press",   "barbell",    0.70),
        ("Incline Bench Press",   "dumbbell",   0.65),
        ("Decline Bench Press",   "barbell",    0.70),
        ("Push-up",               "bodyweight", 0.90),
        ("Dips",                  "bodyweight", 0.85),
        ("Cable Crossover",       "cable",      0.55),
        ("Chest Fly",             "machine",    0.55),
        ("Pec Deck",              "machine",    0.50),
        ("Barbell Row",           "barbell",    0.65),
        ("T-Bar Row",             "barbell",    0.65),
        ("Chest-Supported Row",   "machine",    0.55),
        ("Dumbbell Row",          "dumbbell",   0.60),
        ("Seated Cable Row",      "cable",      0.55),
        ("Lat Pulldown",          "cable",      0.55),
        ("Pull-up",               "bodyweight", 0.85),
        ("Chin-up",               "bodyweight", 0.85),
        ("Rear Delt Fly",         "dumbbell",   0.45),
        ("Overhead Press",        "barbell",    0.55),
        ("Overhead Press",        "dumbbell",   0.50),
        ("Arnold Press",          "dumbbell",   0.50),
        ("Seated Overhead Press", "machine",    0.45),
        ("Lateral Raise",         "dumbbell",   0.40),
        ("Lateral Raise",         "cable",      0.40),
        ("Front Raise",           "dumbbell",   0.40),
        ("Face Pull",             "cable",      0.40),
        ("Barbell Curl",          "barbell",    0.35),
        ("Preacher Curl",         "barbell",    0.35),
        ("Dumbbell Curl",         "dumbbell",   0.30),
        ("Hammer Curl",           "dumbbell",   0.30),
        ("Concentration Curl",    "dumbbell",   0.30),
        ("Incline Dumbbell Curl", "dumbbell",   0.30),
        ("Cable Curl",            "cable",      0.30),
        ("Close-Grip Bench Press","barbell",    0.65),
        ("Skull Crushers",        "barbell",    0.40),
        ("Overhead Tricep Extension","dumbbell",0.35),
        ("Tricep Pushdown",       "cable",      0.35),
        ("Tricep Kickback",       "dumbbell",   0.30),
        ("Deadlift",              "barbell",    1.00),
        ("Bulgarian Split Squat", "dumbbell",   0.85),
        ("Walking Lunges",        "dumbbell",   0.80),
        ("Hip Thrust",            "barbell",    0.80),
        ("Goblet Squat",          "kettlebell", 0.85),
        ("Romanian Deadlift",     "barbell",    0.90),
        ("Romanian Deadlift",     "dumbbell",   0.80),
        ("Stiff-Leg Deadlift",    "barbell",    0.90),
        ("Front Squat",           "barbell",    0.90),
    ]
    for name, equipment, coeff in _PREV:
        op.execute(
            f"UPDATE training.exercises "
            f"SET battle_coefficient = {coeff} "
            f"WHERE is_global = true "
            f"AND name = '{name}' "
            f"AND equipment = '{equipment}'"
        )
