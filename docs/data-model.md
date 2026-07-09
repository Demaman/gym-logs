# Data Model

All tables live in a single PostgreSQL database (`gymlogs`) with one schema per module.
Each schema can become an independent database when its module is extracted to a microservice.

---

## identity schema ✅

```mermaid
erDiagram
    organizations {
        uuid id PK
        varchar(255) name
        timestamptz created_at
    }

    users {
        uuid id PK
        uuid organization_id FK
        varchar(255) email UK
        user_role role
        text hashed_password
        timestamptz created_at
    }

    memberships {
        uuid id PK
        uuid organization_id FK
        uuid trainer_id FK
        uuid athlete_id FK
        timestamptz created_at
    }

    organizations ||--o{ users : "has"
    organizations ||--o{ memberships : "scopes"
    users ||--o{ memberships : "trainer"
    users ||--o{ memberships : "athlete"
```

### Types
- `user_role` — PostgreSQL ENUM: `athlete | trainer | gym_admin`

### Constraints
- `users.email` — globally unique index
- `memberships(trainer_id, athlete_id)` — unique constraint `uq_membership`
- Every row scoped by `organization_id` — cross-org data access is impossible by construction

### Indexes
| Table | Index | Columns |
|---|---|---|
| users | `ix_identity_users_email` | email (unique) |
| users | `ix_identity_users_org` | organization_id |
| memberships | `ix_identity_memberships_org` | organization_id |

---

## training schema ⏳ (planned)

```mermaid
erDiagram
    exercises {
        uuid id PK
        uuid organization_id FK
        varchar name
        varchar muscle_group
        varchar equipment
        timestamptz created_at
    }

    programs {
        uuid id PK
        uuid organization_id FK
        uuid trainer_id FK
        varchar name
        text description
        timestamptz created_at
    }

    sessions {
        uuid id PK
        uuid program_id FK
        int day_number
        varchar name
    }

    session_exercises {
        uuid id PK
        uuid session_id FK
        uuid exercise_id FK
        int sets
        int reps
        float weight_kg
    }

    assignments {
        uuid id PK
        uuid organization_id FK
        uuid program_id FK
        uuid athlete_id FK
        date start_date
        timestamptz created_at
    }

    programs ||--o{ sessions : "has"
    sessions ||--o{ session_exercises : "contains"
    programs ||--o{ assignments : "assigned via"
```

---

## logs schema ⏳ (planned)

```mermaid
erDiagram
    workout_logs {
        uuid id PK
        uuid organization_id FK
        uuid athlete_id FK
        uuid assignment_id FK
        date session_date
        timestamptz logged_at
    }

    set_logs {
        uuid id PK
        uuid workout_log_id FK
        uuid exercise_id FK
        int set_number
        int reps
        float weight_kg
        float rpe
    }

    workout_logs ||--o{ set_logs : "contains"
```

---

## analytics schema ⏳ (planned)

```mermaid
erDiagram
    exercise_progressions {
        uuid id PK
        uuid organization_id FK
        uuid athlete_id FK
        uuid exercise_id FK
        float max_weight_kg
        float estimated_1rm
        float total_volume_kg
        int total_sets
        date last_logged_at
        timestamptz updated_at
    }
```

Built exclusively from `workout.logged` events — never written by any other module.

---

## Schema isolation rule

```
No module may query or write to another module's schema.

identity.* ←→ training.*   ❌  direct join forbidden
identity.* ←→ training.*   ✅  via HTTP service call or event payload
```

This is enforced by convention today and by network boundary when modules are extracted.
