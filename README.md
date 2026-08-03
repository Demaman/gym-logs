# gym-logs

Multi-tenant SaaS for logging training sessions and tracking per-exercise progression.
Athletes log workouts; trainers and gyms create training programs and assign them to clients.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Docker + Docker Compose | 24+ | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Node.js | 20+ | [nodejs.org](https://nodejs.org/) |
| pnpm | 9+ | `npm i -g pnpm` |

The backend runs entirely inside Docker. Node/pnpm are only needed for the frontend dev server.

---

## Quick start

### 1. Clone and configure

```bash
git clone <repo-url>
cd gym-logs

# Create the backend env file
cp .env.example .env
```

Open `.env` and replace `SECRET_KEY` with a real random value:

```bash
# Generate a secure key
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 2. Start everything

```bash
docker compose up --build
```

This builds both images, runs Alembic migrations, and starts all services.

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000 |
| Interactive API docs (Swagger) | http://localhost:8000/docs |
| PostgreSQL | localhost:**5433** |
| Redis | localhost:**6380** |

> Ports 5433 and 6380 are used (not the defaults 5432/6379) to avoid conflicts with locally installed databases.

The first build takes a few minutes while pnpm installs frontend dependencies. Subsequent starts are fast because Docker caches the dependency layer.

---

## Default state

The database starts empty. Register a user at http://localhost:3000 to get started.

**Roles:**
- `athlete` — logs workouts, follows programs
- `trainer` — creates programs, manages athletes
- `gym_admin` — full org-level access

**Solo users** (no organization) can register and create personal training programs without joining a gym.

---

## Common commands

### Backend (run from project root)

```bash
# Start everything
docker compose up --build

# Start in background
docker compose up -d --build

# Stop
docker compose down

# View logs
docker compose logs -f app

# Run tests
docker compose run --rm app uv run pytest

# Run tests, stop on first failure
docker compose run --rm app uv run pytest -x

# Lint + format check
docker compose run --rm app uv run ruff check .
docker compose run --rm app uv run ruff format .

# Create a new migration (after changing a model)
docker compose run --rm app uv run alembic revision --autogenerate -m "describe the change"

# Apply pending migrations
docker compose run --rm app uv run alembic upgrade head

# Rollback one migration
docker compose run --rm app uv run alembic downgrade -1
```

### Frontend (run from `frontend/`)

```bash
pnpm dev          # development server with hot reload
pnpm build        # production build
pnpm lint         # ESLint
pnpm format       # Prettier
pnpm test         # Vitest unit tests
```

---

## Deploying to a remote server

### Backend

1. Copy `.env.example` to `.env` on the server and fill in all values.
2. Set `SECRET_KEY` to a long random string (never reuse local values).
3. Set `DATABASE_URL` and `REDIS_URL` to point at your hosted databases.
4. Run `docker compose up -d --build`.

### Frontend — deploy to Vercel (recommended)

The easiest and cheapest option is Vercel's free tier. The backend stays in Docker on your server.

1. Push the repo to GitHub.
2. In Vercel, import the project and set the **Root Directory** to `frontend`.
3. Add one environment variable in the Vercel dashboard:
   ```
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com
   ```
4. Deploy. Vercel handles builds, CDN, and SSL automatically.

> **i18n note:** The translation system uses static imports and `localStorage` only after mount — no `navigator.language`, no middleware. It always defaults to English on the server, so there are no SSR hydration mismatches and it works on Vercel and any other host without extra configuration.

---

## Architecture overview

```
gym-logs/
├── backend/        Python 3.12 · FastAPI · SQLAlchemy 2 async · Alembic
│   ├── db/         models + repositories (one schema per module)
│   ├── modules/    business logic: identity · training · logs · analytics
│   ├── core/       config · auth (JWT) · events · redis · database
│   └── migrations/ Alembic migration tree
└── frontend/       Next.js 15 · React 19 · TanStack Query · Tailwind · shadcn/ui
    ├── app/        App Router pages
    ├── components/ UI + feature components
    ├── hooks/      TanStack Query hooks
    ├── lib/        API client · auth store · i18n · utils
    └── types/      API response types
```

**Modules:** `identity` (auth, orgs, users) · `training` (programs, exercises) · `logs` (workout sessions, sets) · `analytics` (progression metrics)

Detailed docs are in [`docs/`](docs/).

---

## Languages

The UI ships in **English** and **Brazilian Portuguese**.  
Users can switch language in the app; the preference is saved in `localStorage`.
