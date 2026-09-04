import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import db.models.analytics  # noqa: F401

# Import all models so Base.metadata is fully populated before create_all
import db.models.identity  # noqa: F401
import db.models.logs  # noqa: F401
import db.models.training  # noqa: F401
import core.database as _core_db
from core.config import settings
from core.database import Base, get_db
from core.events import subscribe
from main import app
from modules.logs.events import on_session_finished_record_attendance, on_session_finished_resolve_battle

_TEST_DB_URL = (
    settings.test_database_url
    if settings.test_database_url
    else settings.database_url.replace("/gymlogs", "/gymlogs_test")
)


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    # NullPool: each test creates its own connection in its own event loop —
    # avoids asyncpg cross-loop errors when tests run with per-function loops.
    engine = create_async_engine(_TEST_DB_URL, echo=False, poolclass=NullPool)
    async with engine.begin() as conn:
        # Drop + recreate schemas for a guaranteed clean slate.
        # DROP SCHEMA CASCADE handles cross-schema enum dependencies that
        # Base.metadata.drop_all cannot resolve reliably.
        for schema in ("identity", "training", "logs", "analytics"):
            await conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))
            await conn.execute(text(f"CREATE SCHEMA {schema}"))
        await conn.run_sync(Base.metadata.create_all)
    # Patch AsyncSessionLocal so event handlers (which bypass get_db) use the test DB.
    _orig_session_local = _core_db.AsyncSessionLocal
    _core_db.AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    # Register event handlers that the lifespan would normally register.
    subscribe("workout_session.finished", on_session_finished_record_attendance)
    subscribe("workout_session.finished", on_session_finished_resolve_battle)
    yield engine
    _core_db.AsyncSessionLocal = _orig_session_local
    async with engine.begin() as conn:
        for schema in ("identity", "training", "logs", "analytics"):
            await conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncSession:
    factory = async_sessionmaker(test_engine, expire_on_commit=False)
    async with factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncClient:
    async def _override_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(autouse=True)
async def reset_redis():
    """Give each test a fresh Redis connection in its own event loop."""
    import core.redis as _redis_mod

    _redis_mod._redis = None
    yield
    if _redis_mod._redis is not None:
        await _redis_mod._redis.aclose()
    _redis_mod._redis = None


@pytest.fixture
def fake_redis(monkeypatch):
    """In-memory Redis stub for unit tests that don't need real Redis."""
    store: dict = {}

    class _FakeRedis:
        async def setex(self, key, ttl, value):
            store[key] = value

        async def get(self, key):
            return store.get(key)

        async def delete(self, key):
            store.pop(key, None)

    stub = _FakeRedis()
    monkeypatch.setattr("core.redis._redis", stub)
    return stub
