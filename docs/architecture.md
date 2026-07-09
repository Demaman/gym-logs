# Architecture

## Approach: Modular Monolith → Microservices

The project starts as a single deployable unit but enforces hard module boundaries from
day one so each module can be extracted into its own microservice with minimal rework.

### Decomposability rules
| Rule | Now (monolith) | Later (microservice) |
|---|---|---|
| Module cross-calls | Through `services.py` interfaces only | HTTP API calls |
| Data isolation | Dedicated PostgreSQL schema per module | Dedicated database per service |
| Async integration | `core/events.py` in-process bus | Replace with aio-pika (AMQP) |

---

## Component diagram

```mermaid
graph TB
    Client([HTTP Client])

    subgraph monolith ["gym-logs API  :8000"]
        subgraph core ["core/"]
            Auth["auth.py\nHTTPBearer + JWT decode"]
            Sec["security.py\nargon2 · python-jose"]
            Ev["events.py\nin-process event bus"]
            Redis_["redis.py\nconnection singleton"]
        end

        subgraph identity ["modules/identity  ✅"]
            IR[router.py]
            IS[services.py]
            IRepo[repositories.py]
            IM[models.py]
        end

        subgraph training ["modules/training  ⏳"]
            TR[router.py stub]
        end

        subgraph logs_ ["modules/logs  ⏳"]
            LR[router.py stub]
        end

        subgraph analytics_ ["modules/analytics  ⏳"]
            AR[router.py stub]
        end

        IS -->|publishes| Ev
        IR --> Auth
        IR --> IS
        IS --> IRepo
        IRepo --> IM
    end

    subgraph stores ["Data stores"]
        PG[("PostgreSQL\n──────────\nidentity schema\ntraining schema\nlogs schema\nanalytics schema")]
        RD[("Redis\n──────────\nrefresh tokens\nrate limiting")]
    end

    Client --> monolith
    IRepo --> PG
    Redis_ --> RD
```

---

## Module responsibilities

### identity ✅
Owns all authentication and authorization primitives.
- Organizations (tenants), users, memberships.
- JWT issuance and refresh-token lifecycle.
- Source of truth for identity — other modules never store credentials.

### training ⏳
Exercise catalog, training programs, program assignments.
- Exercises are per-organization (no global catalog).
- Only trainers/gym_admins create programs and assignments.

### logs ⏳
Workout logs per athlete per session.
- Sets, reps, weight, RPE recorded.
- Publishes `workout.logged` event consumed by analytics.

### analytics ⏳
Read-optimized progression metrics.
- Built purely from events emitted by logs.
- Never writes back to logs.

---

## Data store layout

### PostgreSQL — one DB, four schemas

```
gymlogs database
├── identity schema    ← Organization, User, Membership
├── training schema    ← Exercise, Program, Session, Assignment  (planned)
├── logs schema        ← WorkoutLog, SetLog                      (planned)
└── analytics schema   ← ExerciseProgression                     (planned)
```

When a module is extracted: `CREATE DATABASE gymlogs_<name>` + migrate that schema into it.
The application code only changes the `DATABASE_URL` env var for that service.

### Redis

```
refresh:{token}  →  user_id   TTL: 7 days    (refresh token store)
```

---

## Request lifecycle

```mermaid
sequenceDiagram
    participant C as Client
    participant Router
    participant Auth as core/auth.py
    participant Service
    participant Repo
    participant DB as PostgreSQL

    C->>Router: HTTP request + Authorization header
    Router->>Auth: get_current_user(credentials)
    Auth->>Auth: decode_token() via python-jose
    Auth-->>Router: {user_id, organization_id, role}
    Router->>Service: call with validated input + current_user
    Service->>Repo: query scoped by organization_id
    Repo->>DB: async SQLAlchemy query
    DB-->>Repo: result
    Repo-->>Service: domain model
    Service-->>Router: response schema
    Router-->>C: JSON response
```

---

## Internal event bus

`core/events.py` is a thin in-process pub/sub that matches the future AMQP contract.

```mermaid
graph LR
    IS["identity/services.py"]
    LS["logs/services.py\n(planned)"]
    AS["analytics/services.py\n(planned)"]
    EB["core/events.py\npublish / subscribe"]

    IS -->|organization.created\nuser.registered\nmembership.created| EB
    LS -->|workout.logged| EB
    EB -->|workout.logged| AS
```

**Swap path to AMQP:** replace `publish()` with `aio-pika.publish()` and `subscribe()` with
an AMQP consumer registration. Payload schemas are never changed — they are the contract.
