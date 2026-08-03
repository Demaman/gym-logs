import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.analytics.athlete_profile import AthleteProfile


class AthleteProfileRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def get_by_user(self, user_id: uuid.UUID) -> AthleteProfile | None:
        result = await self._s.execute(
            select(AthleteProfile).where(AthleteProfile.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def create(self, user_id: uuid.UUID, organization_id: uuid.UUID | None, **fields) -> AthleteProfile:
        profile = AthleteProfile(user_id=user_id, organization_id=organization_id, **fields)
        self._s.add(profile)
        await self._s.commit()
        await self._s.refresh(profile)
        return profile

    async def update(self, profile: AthleteProfile, **fields) -> AthleteProfile:
        for key, value in fields.items():
            setattr(profile, key, value)
        profile.updated_at = datetime.now(UTC)
        await self._s.commit()
        await self._s.refresh(profile)
        return profile

    async def upsert(self, user_id: uuid.UUID, organization_id: uuid.UUID | None, **fields) -> AthleteProfile:
        profile = await self.get_by_user(user_id)
        if profile is None:
            return await self.create(user_id, organization_id, **fields)
        return await self.update(profile, **fields)
