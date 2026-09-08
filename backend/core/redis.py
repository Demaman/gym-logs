from urllib.parse import urlparse

from redis.asyncio import Redis

from core.config import settings

_redis: Redis | None = None


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        parsed = urlparse(settings.redis_url)
        use_ssl = parsed.scheme == "rediss"
        _redis = Redis(
            host=parsed.hostname,
            port=parsed.port or 6379,
            password=parsed.password,
            username=parsed.username or "default",
            ssl=use_ssl,
            ssl_cert_reqs="none" if use_ssl else None,
            decode_responses=True,
            protocol=2,
        )
    return _redis


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None
