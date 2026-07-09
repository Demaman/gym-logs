# Authentication & JWT

## Design choices

> **We do NOT use FastAPI's built-in `OAuth2PasswordBearer` or form-based auth.**

| Aspect | FastAPI default | Our implementation |
|---|---|---|
| Token extraction | `OAuth2PasswordBearer` (form data, `/token` endpoint) | `HTTPBearer` — reads `Authorization: Bearer <token>` header |
| Login body | `application/x-www-form-urlencoded` `{username, password}` | `application/json` `{email, password}` |
| JWT library | none built-in | `python-jose[cryptography]` |
| Password hashing | none built-in | `argon2-cffi` (argon2id) |
| Refresh tokens | not provided | Redis-backed, rotated on every use |

### Why HTTPBearer over OAuth2PasswordBearer

`OAuth2PasswordBearer` couples the API to the OAuth2 form-post flow, adds an unnecessary
`tokenUrl` field to OpenAPI, and returns a `WWW-Authenticate` header that implies an
OAuth2 server. We are building a custom auth system, not an OAuth2 server. `HTTPBearer`
accepts the same `Authorization: Bearer <token>` header without that baggage.

Note: `HTTPBearer` returns **403** (not 401) when no `Authorization` header is present —
this is FastAPI's default for missing scheme credentials. A 401 is raised by our code
when the token is present but invalid or expired.

---

## Token structure

### Access token (JWT, HS256)

```json
{
  "sub": "<user_id>",
  "org": "<organization_id>",
  "role": "athlete | trainer | gym_admin",
  "exp": <unix_timestamp>
}
```

- Signed with `SECRET_KEY` using HS256 via `python-jose`.
- Default TTL: **30 minutes** (`ACCESS_TOKEN_EXPIRE_MINUTES`).
- Stateless — not stored anywhere. Validated on every request by decoding the signature.

### Refresh token (JWT, HS256, Redis-backed)

- Same payload as access token.
- Default TTL: **7 days** (`REFRESH_TOKEN_EXPIRE_DAYS`).
- Stored in Redis as `refresh:{token} → user_id` with matching TTL.
- **Rotated on every use** — old token is deleted, new pair is issued.
- Revocable at any time by deleting the Redis key (logout).

---

## Registration flow

```mermaid
sequenceDiagram
    participant C as Client
    participant R as POST /identity/auth/register
    participant S as IdentityService
    participant OR as OrgRepository
    participant UR as UserRepository
    participant DB as PostgreSQL
    participant EB as EventBus

    C->>R: {email, password, role, organization_id}
    R->>S: register_user(data)
    S->>UR: get_by_email(email)
    UR->>DB: SELECT users WHERE email = ?
    DB-->>UR: None
    S->>OR: get_by_id(organization_id)
    OR->>DB: SELECT organizations WHERE id = ?
    DB-->>OR: Organization
    Note over S: hash_password(password) via argon2
    S->>UR: create(email, hashed, role, org_id)
    UR->>DB: INSERT INTO identity.users
    DB-->>UR: User row
    S->>EB: publish("user.registered", payload)
    S-->>R: UserResponse (no hashed_password)
    R-->>C: 201 UserResponse
```

---

## Login flow

```mermaid
sequenceDiagram
    participant C as Client
    participant R as POST /identity/auth/login
    participant S as IdentityService
    participant UR as UserRepository
    participant DB as PostgreSQL
    participant Redis

    C->>R: {email, password}
    R->>S: login(email, password)
    S->>UR: get_by_email(email)
    UR->>DB: SELECT users WHERE email = ?
    DB-->>UR: User
    Note over S: verify_password(plain, hashed) via argon2
    Note over S: create_access_token({sub, org, role})
    Note over S: create_refresh_token({sub, org, role})
    S->>Redis: SETEX refresh:{token} 604800 {user_id}
    S-->>R: TokenResponse
    R-->>C: 200 {access_token, refresh_token, token_type}
```

**On failure:** wrong email or wrong password both return **401** with a generic
`"Invalid credentials"` message — no distinction to prevent user enumeration.

---

## Authenticated request flow

```mermaid
sequenceDiagram
    participant C as Client
    participant R as Any protected router
    participant B as HTTPBearer
    participant A as get_current_user()
    participant S as Service

    C->>R: GET /... + Authorization: Bearer <access_token>
    R->>B: extract credentials
    B-->>R: HTTPAuthorizationCredentials
    R->>A: decode_token(access_token)
    Note over A: python-jose verifies signature + expiry
    A-->>R: {user_id, organization_id, role}
    R->>S: service call with CurrentUser
    S-->>R: result scoped to organization_id
    R-->>C: 200 response
```

**No token:** HTTPBearer returns **403** before `get_current_user` is invoked.  
**Invalid/expired token:** `get_current_user` raises **401**.

---

## Token refresh flow

```mermaid
sequenceDiagram
    participant C as Client
    participant R as POST /identity/auth/refresh
    participant S as IdentityService
    participant Redis

    C->>R: {refresh_token}
    R->>S: refresh(refresh_token)
    S->>Redis: GET refresh:{token}
    alt token not found or expired
        Redis-->>S: None
        S-->>R: 401 Invalid or expired refresh token
        R-->>C: 401
    else token valid
        Redis-->>S: user_id
        Note over S: decode_token() to extract payload
        S->>Redis: DEL refresh:{old_token}
        Note over S: create_access_token(payload)
        Note over S: create_refresh_token(payload)
        S->>Redis: SETEX refresh:{new_token} 604800 user_id
        S-->>R: TokenResponse
        R-->>C: 200 {new_access_token, new_refresh_token}
    end
```

---

## Logout flow

```mermaid
sequenceDiagram
    participant C as Client
    participant R as POST /identity/auth/logout
    participant S as IdentityService
    participant Redis

    C->>R: {refresh_token}
    R->>S: logout(refresh_token)
    S->>Redis: DEL refresh:{token}
    S-->>R: None
    R-->>C: 204 No Content
```

After logout the access token remains valid until it expires naturally (stateless JWT).
If immediate access token revocation is needed in the future, add a Redis denylist keyed
by `jti` claim.

---

## Security file map

| File | Responsibility |
|---|---|
| [core/security.py](../app/core/security.py) | `hash_password`, `verify_password`, `create_access_token`, `create_refresh_token`, `decode_token` |
| [core/auth.py](../app/core/auth.py) | `get_current_user` dependency, `CurrentUser` type alias |
| [core/redis.py](../app/core/redis.py) | Redis connection singleton used for refresh token storage |
| [modules/identity/services.py](../app/modules/identity/services.py) | `login`, `refresh`, `logout` — all token lifecycle logic |
