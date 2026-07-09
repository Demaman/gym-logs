# gym-logs

Multi-tenant SaaS for logging training sessions and tracking per-exercise progression.
Athletes log workouts; trainers and gyms create training programs and assign them to clients.

## Architecture: Modular Monolith → Microservices

We start as a **modular monolith** — one deployable unit — designed so each module can be
extracted into an independent microservice when scale demands it.

**Decomposability rules enforced from day one:**
- Modules NEVER import from each other's internals. Cross-module calls go through the
  public service interface only (`modules/<name>/services.py`).
- Every module owns a dedicated PostgreSQL schema (`identity`, `training`, `logs`,
  `analytics`). When a module is extracted, that schema becomes its own database.
- `core/events.py` is an in-process event bus that mirrors the AMQP payload contract.
  When a module is extracted, `publish()` swaps to aio-pika — payloads never change.

## Modules
- `identity`  — users, organizations (tenants), roles, authentication.
- `training`  — exercise catalog, training programs/sessions, program assignment.
- `logs`      — workout logs: sets, reps, weight, RPE recorded per session.
- `analytics` — progression metrics and per-exercise evolution. Read-optimized.

Each module has its own `CLAUDE.md` with its entities, events, and rules.
Read that file before working inside a module.

## Stack
- Python 3.12+, FastAPI, Pydantic v2
- SQLAlchemy 2.0 (async) + Alembic
- PostgreSQL — single DB, one schema per module
- Redis — caching, rate-limiting, refresh-token/session state
- Deps: uv. Lint + format: ruff. Tests: pytest + pytest-asyncio
- Docker + Docker Compose

## Layout
```
gym-logs/
├── CLAUDE.md
├── .claude/
│   ├── settings.json
│   ├── rules/             testing.md, api-conventions.md
│   └── hooks/             run-tests.sh
├── backend/
│   ├── db/                ← all database code lives here, organized by domain
│   │   ├── constants/     identity.py  training.py  logs.py  analytics.py
│   │   ├── models/
│   │   │   ├── identity/  organization.py  user.py  membership.py
│   │   │   ├── training/  (planned)
│   │   │   ├── logs/      (planned)
│   │   │   └── analytics/ (planned)
│   │   └── repositories/
│   │       ├── identity/  organization.py  user.py  membership.py
│   │       ├── training/  (planned)
│   │       ├── logs/      (planned)
│   │       └── analytics/ (planned)
│   ├── core/              config, database, security, auth, events, redis
│   ├── modules/           business logic only — no direct DB access
│   │   ├── identity/      CLAUDE.md · schemas/ · services.py · router.py · events.py
│   │   ├── training/      CLAUDE.md · router.py (stub)
│   │   ├── logs/          CLAUDE.md · router.py (stub)
│   │   └── analytics/     CLAUDE.md · router.py (stub)
│   ├── migrations/        Alembic — schema-aware, single migration tree
│   ├── tests/
│   ├── main.py
│   ├── alembic.ini
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── CLAUDE.md              ← frontend conventions — read before touching frontend/
│   ├── app/                   Next.js App Router pages
│   ├── components/            ui/ (shadcn) + feature components
│   ├── lib/                   api client, auth store, utils
│   ├── hooks/                 TanStack Query hooks
│   └── types/                 API response types
├── docker-compose.yml
├── docs/
└── .env.example
```

### db/ conventions
- `db/constants/<domain>.py` — PostgreSQL schema name + domain-level constants (e.g. `Role`).
- `db/models/<domain>/<entity>.py` — one SQLAlchemy model per file.
  `db/models/<domain>/__init__.py` re-exports all models for that domain.
- `db/repositories/<domain>/<entity>.py` — one repository class per file.
  `db/repositories/<domain>/__init__.py` re-exports all repositories for that domain.
- Cross-model string forward-refs (`"User"`, `"Membership"`) are resolved by SQLAlchemy's
  mapper at runtime; ruff F821 is suppressed for `db/models/*/*.py`.

## Commands
- Start:           `docker compose up --build`
- Tests:           `docker compose run --rm app uv run pytest`
- Lint + format:   `docker compose run --rm app uv run ruff check . && uv run ruff format .`
- New migration:   `docker compose run --rm app uv run alembic revision --autogenerate -m "<msg>"`
- Apply:           `docker compose run --rm app uv run alembic upgrade head`

## Architecture rules
- NEVER import across module boundaries directly. Go through `services.py` interfaces only.
- NEVER put business logic in routers. Routers call services; services call repositories.
- ALL database access goes through `repositories/` — no queries in routers or services.
- ALWAYS use async end to end: `async def`, async SQLAlchemy session.
- ALWAYS publish a domain event via `core/events.py` when state other modules depend on changes.
- ALWAYS scope queries by `organization_id` on every tenant-owned table — no exceptions.

## Multi-tenancy & auth
- Every tenant-owned row carries `organization_id`. EVERY query is scoped by it.
- Roles: `athlete`, `trainer`, `gym_admin`. Authorization enforced in `services/`.
- Auth: JWT access token (short-lived) + refresh token (Redis-backed, revocable).
- `core/auth.py` provides `CurrentUser` dependency for all protected routes.

## Conventions
- ALWAYS add an Alembic migration for any model change; never edit the DB by hand.
- Config via environment variables only (Pydantic Settings). Never hardcode secrets.
- Run ruff before finishing any change.

## Testing (non-negotiable)
- ALWAYS add pytest tests for every new endpoint, service method, and event handler.
- The full suite MUST pass before any work is considered done.
- NEVER edit or delete a test to make it pass — fix the code.
- Run: `docker compose run --rm app uv run pytest`
