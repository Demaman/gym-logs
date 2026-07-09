# analytics module

Read-optimized module for per-exercise progression metrics. Built from events emitted
by the `logs` module. Read the root `CLAUDE.md` for stack, layout, and architecture rules.

## Entities (to be implemented)
- `ExerciseProgression` — aggregated stats per exercise per athlete:
  max weight, total volume, estimated 1RM, trend over time.

## Events consumed
- `workout.logged` → update progression stats for each exercise in the log.

## Rules
- This module NEVER writes through the logs module — it only reads events.
- Queries are read-heavy: index for athlete + exercise lookups.
- All queries scoped by `organization_id`.
