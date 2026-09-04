import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.identity.api_key import ApiKey


class ApiKeyRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def create(
        self,
        *,
        organization_id: uuid.UUID,
        created_by_id: uuid.UUID,
        name: str,
        key_prefix: str,
        key_hash: str,
        scopes: list[str],
        expires_at: datetime | None = None,
    ) -> ApiKey:
        key = ApiKey(
            organization_id=organization_id,
            created_by_id=created_by_id,
            name=name,
            key_prefix=key_prefix,
            key_hash=key_hash,
            scopes=scopes,
            expires_at=expires_at,
        )
        self._s.add(key)
        await self._s.commit()
        await self._s.refresh(key)
        return key

    async def get_active_by_hash(self, key_hash: str) -> ApiKey | None:
        now = datetime.now(UTC)
        stmt = select(ApiKey).where(
            ApiKey.key_hash == key_hash,
            ApiKey.is_active.is_(True),
        )
        result = await self._s.execute(stmt)
        key = result.scalar_one_or_none()
        if key is None:
            return None
        if key.expires_at is not None and key.expires_at < now:
            return None
        return key

    async def list_for_org(self, organization_id: uuid.UUID) -> list[ApiKey]:
        stmt = (
            select(ApiKey)
            .where(
                ApiKey.organization_id == organization_id,
                ApiKey.is_active.is_(True),
            )
            .order_by(ApiKey.created_at.desc())
        )
        result = await self._s.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(
        self, key_id: uuid.UUID, organization_id: uuid.UUID
    ) -> ApiKey | None:
        result = await self._s.execute(
            select(ApiKey).where(
                ApiKey.id == key_id,
                ApiKey.organization_id == organization_id,
            )
        )
        return result.scalar_one_or_none()

    async def revoke(self, key: ApiKey) -> None:
        key.is_active = False
        await self._s.commit()

    async def touch(self, key: ApiKey) -> None:
        key.last_used_at = datetime.now(UTC)
        await self._s.commit()
