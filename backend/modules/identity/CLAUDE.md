# identity module

Owns users, organizations (tenants), roles, and authentication. Source of truth for
*who* a user is and *what organization* they belong to. Other modules must never store
credentials or duplicate the user record — call identity's service interface instead.

Read the root `CLAUDE.md` first for stack, layout, and architecture rules.

## Entities
- `Organization` — a tenant: a gym, a solo trainer's practice, or an individual.
  Root of multi-tenancy; every other tenant-owned row references it. Schema: `identity`.
- `User` — belongs to exactly one organization. Role: `athlete | trainer | gym_admin`.
- `Membership` — trainer↔athlete link within the same organization.
- Credentials are stored as argon2 hashes on the `User` row — no separate table needed.

## Responsibilities
- Organization registration.
- User registration and login.
- JWT issuance (access token) + refresh token lifecycle (Redis-backed, revocable).
- Managing memberships and role assignment.
- Providing the token/identity that all other modules trust via `CurrentUser`.

## Events published (via core/events.py)
- `user.registered`    → `{user_id, organization_id, role}`
- `user.role_changed`  → `{user_id, organization_id, old_role, new_role}`
- `organization.created` → `{organization_id, name}`
- `membership.created` → `{membership_id, organization_id, trainer_id, athlete_id}`

## Rules
- Passwords hashed with argon2. NEVER log, return, or expose credentials.
- Access tokens are short-lived (default 30 min).
- Refresh tokens are stored in Redis with a TTL and rotated on every use.
- A user belongs to exactly one organization — cross-org access is impossible by construction.
- This module does NOT know about exercises, programs, or logs. Keep that domain out.
