import hashlib
import hmac
import secrets
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.redis import get_redis
from db.repositories.identity import ApiKeyRepository

_KEY_PREFIX = "gk_"
_PREFIX_DISPLAY_LEN = 8
_RATE_LIMIT = 1000  # requests per 60-second window

VALID_SCOPES: frozenset[str] = frozenset(
    {
        "members:read",
        "members:write",
        "attendance:write",
        "programs:read",
        "data:export",
    }
)


# ---------------------------------------------------------------------------
# Key generation
# ---------------------------------------------------------------------------


def generate_api_key() -> tuple[str, str, str]:
    """Return (plaintext_key, display_prefix, key_hash)."""
    random_part = secrets.token_urlsafe(32)
    plaintext = f"{_KEY_PREFIX}{random_part}"
    prefix = random_part[:_PREFIX_DISPLAY_LEN]
    key_hash = _hmac_key(plaintext)
    return plaintext, prefix, key_hash


def _hmac_key(key: str) -> str:
    """HMAC-SHA256 of the key using the app secret. Fast, secure for high-entropy keys."""
    return hmac.new(
        settings.secret_key.encode(),
        key.encode(),
        hashlib.sha256,
    ).hexdigest()


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------


async def _resolve_api_key(
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> dict:
    raw_key = request.headers.get("X-API-Key")
    if not raw_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-API-Key header is required",
        )

    key_hash = _hmac_key(raw_key)
    repo = ApiKeyRepository(db)
    api_key = await repo.get_active_by_hash(key_hash)
    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API key",
        )

    await _enforce_rate_limit(redis, str(api_key.id))
    await repo.touch(api_key)

    return {
        "organization_id": str(api_key.organization_id),
        "api_key_id": str(api_key.id),
        "scopes": api_key.scopes,
    }


async def _enforce_rate_limit(redis: Redis, key_id: str) -> None:
    redis_key = f"api_rate:{key_id}"
    count = await redis.incr(redis_key)
    if count == 1:
        await redis.expire(redis_key, 60)
    if count > _RATE_LIMIT:
        ttl = await redis.ttl(redis_key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded — 1000 requests per minute",
            headers={"Retry-After": str(max(ttl, 1))},
        )


ApiKeyContext = Annotated[dict, Depends(_resolve_api_key)]


def require_scope(scope: str) -> Depends:
    """Dependency factory — verifies that the resolved API key has the given scope."""

    async def _check(ctx: ApiKeyContext) -> dict:
        if scope not in ctx["scopes"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This API key is missing the required scope: '{scope}'",
            )
        return ctx

    return Depends(_check)
