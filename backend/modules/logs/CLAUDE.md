# logs module

Records workout logs: sets, reps, weight, and RPE per exercise per session.
Read the root `CLAUDE.md` for stack, layout, and architecture rules.

## Entities (to be implemented)
- `WorkoutLog` — a single athlete's log for a training session date.
- `SetLog`     — one set within a WorkoutLog: exercise_id, set_number, reps, weight, rpe.

## Events published
- `workout.logged` → `{log_id, athlete_id, organization_id, session_date, sets: [...]}`
  (consumed by analytics to update progression metrics)

## Rules
- Athletes may only log their own sessions.
- Trainers may read logs for their assigned athletes.
- All queries scoped by `organization_id`.
