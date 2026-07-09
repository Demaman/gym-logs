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
