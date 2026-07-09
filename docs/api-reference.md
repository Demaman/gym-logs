# API Reference

Base URL: `http://localhost:8000/api/v1`

Interactive docs (when running): `http://localhost:8000/docs`

---

## Authentication

Protected routes require:
```
Authorization: Bearer <access_token>
```

Tokens are obtained from `/identity/auth/login`.  
We use `HTTPBearer` — **not** FastAPI's OAuth2 form flow.

---

## identity module

### Organizations

#### `POST /identity/organizations`
Create a new tenant organization.

**Request body**
```json
{ "name": "Iron Gym" }
```

**Response** `201`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Iron Gym",
  "created_at": "2026-06-30T12:00:00Z"
}
```

---

### Auth

#### `POST /identity/auth/register`
Register a new user within an existing organization.

**Request body**
```json
{
  "email": "athlete@example.com",
  "password": "min8chars",
  "role": "athlete",
  "organization_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

`role` must be one of: `athlete`, `trainer`, `gym_admin`  
`password` minimum length: 8 characters

**Response** `201`
```json
{
  "id": "...",
  "email": "athlete@example.com",
  "role": "athlete",
  "organization_id": "...",
  "created_at": "2026-06-30T12:00:00Z"
}
```

**Errors**
| Status | Reason |
|---|---|
| 409 | Email already registered |
| 404 | Organization not found |
| 422 | Validation error (short password, invalid role, etc.) |

---

#### `POST /identity/auth/login`
Authenticate and obtain tokens.

**Request body**
```json
{
  "email": "athlete@example.com",
  "password": "min8chars"
}
```

**Response** `200`
```json
{
  "access_token": "<jwt>",
  "refresh_token": "<jwt>",
  "token_type": "bearer"
}
```

**Errors**
| Status | Reason |
|---|---|
| 401 | Invalid credentials (email or password wrong — no distinction) |

---

#### `POST /identity/auth/refresh`
Exchange a valid refresh token for a new token pair. Old refresh token is revoked.

**Request body**
```json
{ "refresh_token": "<jwt>" }
```

**Response** `200`
```json
{
  "access_token": "<new_jwt>",
  "refresh_token": "<new_jwt>",
  "token_type": "bearer"
}
```

**Errors**
| Status | Reason |
|---|---|
| 401 | Token not found in Redis (expired or already used/revoked) |

---

#### `POST /identity/auth/logout`
Revoke the refresh token. Access token expires naturally (stateless).

**Request body**
```json
{ "refresh_token": "<jwt>" }
```

**Response** `204 No Content`

---

### Users

#### `GET /identity/users/me` 🔒
Return the profile of the authenticated user.

**Headers** `Authorization: Bearer <access_token>`

**Response** `200`
```json
{
  "id": "...",
  "email": "athlete@example.com",
  "role": "athlete",
  "organization_id": "...",
  "created_at": "2026-06-30T12:00:00Z"
}
```

**Errors**
| Status | Reason |
|---|---|
| 403 | No `Authorization` header present |
| 401 | Token invalid or expired |

---

### Memberships

#### `POST /identity/memberships` 🔒
Link a trainer to an athlete within the same organization.

**Headers** `Authorization: Bearer <access_token>`  
(caller's `organization_id` is taken from the token — not the request body)

**Request body**
```json
{
  "trainer_id": "<uuid of a trainer or gym_admin in this org>",
  "athlete_id": "<uuid of an athlete in this org>"
}
```

**Response** `201`
```json
{
  "id": "...",
  "organization_id": "...",
  "trainer_id": "...",
  "athlete_id": "...",
  "created_at": "2026-06-30T12:00:00Z"
}
```

**Errors**
| Status | Reason |
|---|---|
| 400 | `trainer_id` is not a trainer/gym_admin in this org |
| 400 | `athlete_id` is not an athlete in this org |
| 403 | No auth header |
| 401 | Token invalid or expired |

---

## Health check

#### `GET /health`
Returns `200 {"status": "ok"}` when the app is running.

---

## training module ⏳

No endpoints implemented yet. See [modules/training/CLAUDE.md](../app/modules/training/CLAUDE.md)
for planned entities and events.

---

## logs module ⏳

No endpoints implemented yet. See [modules/logs/CLAUDE.md](../app/modules/logs/CLAUDE.md)
for planned entities and events.

---

## analytics module ⏳

No endpoints implemented yet. See [modules/analytics/CLAUDE.md](../app/modules/analytics/CLAUDE.md)
for planned entities and events.
