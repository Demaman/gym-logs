import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.identity.organization import Organization


class OrganizationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def create(self, name: str, **kwargs) -> Organization:
        org = Organization(name=name, **kwargs)
        self._s.add(org)
        await self._s.commit()
        await self._s.refresh(org)
        return org

    async def update(self, org: Organization, **kwargs) -> Organization:
        for key, val in kwargs.items():
            setattr(org, key, val)
        await self._s.commit()
        await self._s.refresh(org)
        return org

    async def get_by_id(self, org_id: uuid.UUID) -> Organization | None:
        result = await self._s.execute(
            select(Organization).where(Organization.id == org_id)
        )
        return result.scalar_one_or_none()
