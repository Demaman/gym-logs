# training module

Owns the exercise catalog, training programs, program sessions, and program assignments
(trainer → athlete). Read the root `CLAUDE.md` for stack, layout, and architecture rules.

## Entities (to be implemented)
- `Exercise`  — name, muscle group, equipment. Scoped to organization.
- `Program`   — a named training plan composed of sessions. Owned by a trainer.
- `Session`   — a day's worth of exercises within a program.
- `Assignment`— links a Program to an athlete (via a Membership).

## Events published
- `program.assigned` → `{assignment_id, program_id, athlete_id, organization_id}`

## Events consumed
- `membership.created` → cache the trainer↔athlete link locally if needed.

## Rules
- Exercise catalog is per-organization — no global/shared exercises.
- Only trainers and gym_admins may create programs and assign them.
- All queries scoped by `organization_id`.
