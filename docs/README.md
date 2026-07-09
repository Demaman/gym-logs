# gym-logs — Backend Docs

| Doc | Contents |
|---|---|
| [architecture.md](architecture.md) | System overview, module boundaries, data stores, event bus |
| [auth-flow.md](auth-flow.md) | JWT strategy, token lifecycle, UML sequence diagrams |
| [data-model.md](data-model.md) | ER diagrams per module schema |
| [api-reference.md](api-reference.md) | All implemented endpoints with request/response shapes |

## Quick start

```bash
cp .env.example .env          # fill in SECRET_KEY
docker compose up --build     # runs migrations then starts on :8000
```

## Run tests

```bash
docker compose run --rm app uv run pytest
```

## Current implementation status

| Module | Status | Notes |
|---|---|---|
| `identity` | **Complete** | Orgs, users, auth, memberships, JWT, Redis refresh |
| `training` | Stub | Router wired, no endpoints yet |
| `logs` | Stub | Router wired, no endpoints yet |
| `analytics` | Stub | Router wired, no endpoints yet |
