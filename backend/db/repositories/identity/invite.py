import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.identity.invite import Invite


class InviteRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def create(
        self,
        *,
        organization_id: uuid.UUID,
        invited_by_id: uuid.UUID,
        email: str,
        role: str,
        expires_at: datetime,
        pre_filled_data: dict | None = None,
    ) -> Invite:
        invite = Invite(
            organization_id=organization_id,
            invited_by_id=invited_by_id,
            email=email.lower(),
            role=role,
            expires_at=expires_at,
            pre_filled_data=pre_filled_data,
        )
        self._s.add(invite)
        await self._s.commit()
        await self._s.refresh(invite)
        return invite

    async def get_by_id(self, invite_id: uuid.UUID) -> Invite | None:
        result = await self._s.execute(
            select(Invite).where(Invite.id == invite_id)
        )
        return result.scalar_one_or_none()

    async def get_pending_by_email(self, email: str) -> Invite | None:
        """Return the most recent non-expired, unaccepted invite for this email."""
        result = await self._s.execute(
            select(Invite)
            .where(
                Invite.email == email.lower(),
                Invite.accepted_at.is_(None),
                Invite.expires_at > datetime.now(UTC),
            )
            .order_by(Invite.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def list_pending_by_email(self, email: str) -> list[Invite]:
        """Non-expired, unaccepted invites for this email."""
        result = await self._s.execute(
            select(Invite)
            .where(
                Invite.email == email.lower(),
                Invite.accepted_at.is_(None),
                Invite.expires_at > datetime.now(UTC),
            )
            .order_by(Invite.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_pending_by_email_and_org(
        self, email: str, organization_id: uuid.UUID
    ) -> Invite | None:
        result = await self._s.execute(
            select(Invite)
            .where(
                Invite.email == email.lower(),
                Invite.organization_id == organization_id,
                Invite.accepted_at.is_(None),
            )
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def accept(self, invite: Invite) -> Invite:
        invite.accepted_at = datetime.now(UTC)
        await self._s.commit()
        await self._s.refresh(invite)
        return invite

    async def list_by_org(self, organization_id: uuid.UUID) -> list[Invite]:
        result = await self._s.execute(
            select(Invite)
            .where(
                Invite.organization_id == organization_id,
                Invite.accepted_at.is_(None),
                Invite.expires_at > datetime.now(UTC),
            )
            .order_by(Invite.created_at.desc())
        )
        return list(result.scalars().all())

    async def delete(self, invite: Invite) -> None:
        await self._s.delete(invite)
        await self._s.commit()
