from redis.asyncio import Redis

from core.config import settings

_redis: Redis | None = None


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        kwargs: dict = {"decode_responses": True, "protocol": 2}
        if settings.redis_url.startswith("rediss://"):
            kwargs["ssl_cert_reqs"] = "none"
        _redis = Redis.from_url(settings.redis_url, **kwargs)
    return _redis


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None
