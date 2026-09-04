import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.identity.partner import PartnerConfig, PartnerMember


class PartnerConfigRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def get_by_org_platform(
        self, org_id: uuid.UUID, platform: str
    ) -> PartnerConfig | None:
        result = await self._s.execute(
            select(PartnerConfig).where(
                PartnerConfig.organization_id == org_id,
                PartnerConfig.platform == platform,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_external_gym_id(
        self, external_gym_id: str, platform: str
    ) -> PartnerConfig | None:
        """Route inbound webhooks — look up config by platform gym identifier."""
        result = await self._s.execute(
            select(PartnerConfig).where(
                PartnerConfig.external_gym_id == external_gym_id,
                PartnerConfig.platform == platform,
                PartnerConfig.is_active == True,  # noqa: E712
            )
        )
        return result.scalar_one_or_none()

    async def upsert(
        self,
        org_id: uuid.UUID,
        platform: str,
        external_gym_id: str,
        bearer_token: str,
        webhook_secret: str,
    ) -> PartnerConfig:
        existing = await self.get_by_org_platform(org_id, platform)
        if existing:
            existing.external_gym_id = external_gym_id
            existing.bearer_token = bearer_token
            existing.webhook_secret = webhook_secret
            existing.is_active = True
            existing.updated_at = datetime.now(UTC)
            await self._s.commit()
            await self._s.refresh(existing)
            return existing

        config = PartnerConfig(
            organization_id=org_id,
            platform=platform,
            external_gym_id=external_gym_id,
            bearer_token=bearer_token,
            webhook_secret=webhook_secret,
        )
        self._s.add(config)
        await self._s.commit()
        await self._s.refresh(config)
        return config

    async def deactivate(self, org_id: uuid.UUID, platform: str) -> None:
        config = await self.get_by_org_platform(org_id, platform)
        if config:
            config.is_active = False
            config.updated_at = datetime.now(UTC)
            await self._s.commit()


class PartnerMemberRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def get_by_external_id(
        self, org_id: uuid.UUID, platform: str, external_member_id: str
    ) -> PartnerMember | None:
        result = await self._s.execute(
            select(PartnerMember).where(
                PartnerMember.organization_id == org_id,
                PartnerMember.platform == platform,
                PartnerMember.external_member_id == external_member_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_user(
        self, org_id: uuid.UUID, platform: str, user_id: uuid.UUID
    ) -> PartnerMember | None:
        result = await self._s.execute(
            select(PartnerMember).where(
                PartnerMember.organization_id == org_id,
                PartnerMember.platform == platform,
                PartnerMember.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        org_id: uuid.UUID,
        platform: str,
        user_id: uuid.UUID,
        external_member_id: str,
    ) -> PartnerMember:
        member = PartnerMember(
            organization_id=org_id,
            platform=platform,
            user_id=user_id,
            external_member_id=external_member_id,
        )
        self._s.add(member)
        await self._s.commit()
        await self._s.refresh(member)
        return member

    async def delete(
        self, org_id: uuid.UUID, platform: str, user_id: uuid.UUID
    ) -> None:
        mapping = await self.get_by_user(org_id, platform, user_id)
        if mapping:
            await self._s.delete(mapping)
            await self._s.commit()

    async def list_for_org(
        self,
        org_id: uuid.UUID,
        platform: str,
        limit: int = 100,
        offset: int = 0,
    ) -> list[PartnerMember]:
        result = await self._s.execute(
            select(PartnerMember)
            .where(
                PartnerMember.organization_id == org_id,
                PartnerMember.platform == platform,
            )
            .order_by(PartnerMember.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())
