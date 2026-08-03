import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.identity.membership import Membership


class MembershipRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def create(
        self,
        *,
        organization_id: uuid.UUID | None,
        trainer_id: uuid.UUID,
        athlete_id: uuid.UUID,
    ) -> Membership:
        membership = Membership(
            organization_id=organization_id,
            trainer_id=trainer_id,
            athlete_id=athlete_id,
        )
        self._s.add(membership)
        await self._s.commit()
        await self._s.refresh(membership)
        return membership

    async def list_by_org(self, organization_id: uuid.UUID) -> list[Membership]:
        result = await self._s.execute(
            select(Membership).where(Membership.organization_id == organization_id)
        )
        return list(result.scalars().all())

    async def list_by_user(self, user_id: uuid.UUID) -> list[Membership]:
        """For solo/independent users — returns all memberships they are part of."""
        result = await self._s.execute(
            select(Membership).where(
                or_(
                    Membership.trainer_id == user_id,
                    Membership.athlete_id == user_id,
                )
            )
        )
        return list(result.scalars().all())

    async def get_by_id(self, membership_id: uuid.UUID) -> Membership | None:
        result = await self._s.execute(
            select(Membership).where(Membership.id == membership_id)
        )
        return result.scalar_one_or_none()

    async def delete(self, membership: Membership) -> None:
        await self._s.delete(membership)
        await self._s.commit()

    async def list_by_trainer(
        self, trainer_id: uuid.UUID, organization_id: uuid.UUID | None
    ) -> list[Membership]:
        stmt = select(Membership).where(Membership.trainer_id == trainer_id)
        if organization_id is not None:
            stmt = stmt.where(Membership.organization_id == organization_id)
        else:
            stmt = stmt.where(Membership.organization_id.is_(None))
        result = await self._s.execute(stmt)
        return list(result.scalars().all())

    async def list_by_athlete(
        self, athlete_id: uuid.UUID, organization_id: uuid.UUID | None
    ) -> list[Membership]:
        stmt = select(Membership).where(Membership.athlete_id == athlete_id)
        if organization_id is not None:
            stmt = stmt.where(Membership.organization_id == organization_id)
        else:
            stmt = stmt.where(Membership.organization_id.is_(None))
        result = await self._s.execute(stmt)
        return list(result.scalars().all())
