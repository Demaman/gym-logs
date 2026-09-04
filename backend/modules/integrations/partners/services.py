import json
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from db.repositories.identity import (
    PartnerConfigRepository,
    PartnerMemberRepository,
    UserRepository,
)
from db.repositories.logs import AttendanceRepository
from modules.integrations.partners.adapters import PlatformAdapter, get_adapter
from modules.integrations.partners.client import PartnerClient
from modules.integrations.partners.schemas import (
    PartnerConfigCreate,
    PartnerConfigResponse,
    PartnerLinkMemberRequest,
    PartnerMemberResponse,
    PartnerValidateRequest,
    PartnerValidateResponse,
    PartnerWebhookResponse,
)
from modules.integrations.partners.security import check_timestamp, verify_signature

_ROLE_GYM_ADMIN = "gym_admin"


def _require_gym_admin(user: dict) -> uuid.UUID:
    """Raise 403 if caller is not a gym_admin. Returns org UUID."""
    if user.get("role") != _ROLE_GYM_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only gym admins can perform this action",
        )
    org_id_str = user.get("organization_id")
    if not org_id_str:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User has no organization",
        )
    return uuid.UUID(org_id_str)


def _require_adapter(platform: str) -> PlatformAdapter:
    """Return adapter or raise 400 for unknown platforms."""
    adapter = get_adapter(platform)
    if adapter is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported platform: {platform}",
        )
    return adapter


class PartnerService:
    def __init__(self, session: AsyncSession) -> None:
        self._config_repo = PartnerConfigRepository(session)
        self._member_repo = PartnerMemberRepository(session)
        self._user_repo = UserRepository(session)
        self._attendance_repo = AttendanceRepository(session)
        self._client = PartnerClient()

    # ------------------------------------------------------------------
    # Config management (gym_admin only)
    # ------------------------------------------------------------------

    async def configure(
        self, user: dict, platform: str, data: PartnerConfigCreate
    ) -> PartnerConfigResponse:
        _require_adapter(platform)
        org_id = _require_gym_admin(user)
        config = await self._config_repo.upsert(
            org_id=org_id,
            platform=platform,
            external_gym_id=data.external_gym_id,
            bearer_token=data.bearer_token,
            webhook_secret=data.webhook_secret,
        )
        return PartnerConfigResponse.model_validate(config)

    async def get_config(
        self, user: dict, platform: str
    ) -> PartnerConfigResponse:
        _require_adapter(platform)
        org_id = _require_gym_admin(user)
        config = await self._config_repo.get_by_org_platform(org_id, platform)
        if config is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No {platform} configuration found for this organization",
            )
        return PartnerConfigResponse.model_validate(config)

    # ------------------------------------------------------------------
    # Member linking (gym_admin only)
    # ------------------------------------------------------------------

    async def link_member(
        self, user: dict, platform: str, data: PartnerLinkMemberRequest
    ) -> PartnerMemberResponse:
        _require_adapter(platform)
        org_id = _require_gym_admin(user)
        target_user_id = uuid.UUID(data.user_id)

        # Verify the target user belongs to the same org (cross-org isolation)
        target_user = await self._user_repo.get_by_id(target_user_id)
        if target_user is None or target_user.organization_id != org_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found in this organization",
            )

        existing = await self._member_repo.get_by_user(org_id, platform, target_user_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"This user is already linked to a {platform} external_member_id"
                ),
            )

        existing_ext = await self._member_repo.get_by_external_id(
            org_id, platform, data.external_member_id
        )
        if existing_ext:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This external_member_id is already linked to another user",
            )

        mapping = await self._member_repo.create(
            org_id, platform, target_user_id, data.external_member_id
        )
        return PartnerMemberResponse(
            user_id=str(mapping.user_id),
            external_member_id=mapping.external_member_id,
        )

    async def unlink_member(
        self, user: dict, platform: str, target_user_id: str
    ) -> None:
        _require_adapter(platform)
        org_id = _require_gym_admin(user)
        uid = uuid.UUID(target_user_id)
        mapping = await self._member_repo.get_by_user(org_id, platform, uid)
        if mapping is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No {platform} mapping found for this user",
            )
        await self._member_repo.delete(org_id, platform, uid)

    async def list_members(
        self, user: dict, platform: str
    ) -> list[PartnerMemberResponse]:
        _require_adapter(platform)
        org_id = _require_gym_admin(user)
        members = await self._member_repo.list_for_org(org_id, platform)
        return [
            PartnerMemberResponse(
                user_id=str(m.user_id),
                external_member_id=m.external_member_id,
            )
            for m in members
        ]

    # ------------------------------------------------------------------
    # Inbound webhook — no user context, HMAC-verified
    # ------------------------------------------------------------------

    async def handle_webhook_raw(
        self, platform: str, body: bytes, signature: str
    ) -> PartnerWebhookResponse:
        """Parse the raw webhook body, verify HMAC+timestamp, then process."""
        adapter = _require_adapter(platform)

        try:
            data = json.loads(body)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid webhook payload",
            )

        # Extract gym identifier to look up the config / secret
        external_gym_id = adapter.extract_external_gym_id(data)
        if not external_gym_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Webhook payload missing gym identifier",
            )

        config = await self._config_repo.get_by_external_gym_id(
            external_gym_id, platform
        )
        if config is None:
            # Return 401 — don't reveal whether the gym_id exists
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized",
            )

        # Verify HMAC on raw bytes (prevents canonicalization attacks)
        if not verify_signature(body, signature, config.webhook_secret):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized",
            )

        # Reject replayed webhooks older than 5 minutes
        timestamp = adapter.extract_timestamp(data)
        if not timestamp or not check_timestamp(timestamp):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized",
            )

        return await self._process_webhook(
            adapter, data, config.organization_id, platform
        )

    async def _process_webhook(
        self,
        adapter: PlatformAdapter,
        data: dict,
        org_id: uuid.UUID,
        platform: str,
    ) -> PartnerWebhookResponse:
        external_member_id = adapter.extract_external_id(data)
        if not external_member_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Webhook payload missing member identifier",
            )

        member = await self._member_repo.get_by_external_id(
            org_id, platform, external_member_id
        )
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{platform} member not linked to this organization",
            )

        checked_in_at = datetime.now(UTC)
        today = checked_in_at.date()

        already = await self._attendance_repo.already_checked_in_today(
            organization_id=org_id,
            user_id=member.user_id,
            today=today,
            source=platform,
        )
        if not already:
            transaction_id = adapter.extract_transaction_id(data)
            await self._attendance_repo.create(
                organization_id=org_id,
                user_id=member.user_id,
                checked_in_at=checked_in_at,
                source=platform,
                external_ref=transaction_id,
            )

        return PartnerWebhookResponse(status="ok")

    # ------------------------------------------------------------------
    # Outbound validation (gym_admin only)
    # ------------------------------------------------------------------

    async def validate_member(
        self, user: dict, platform: str, data: PartnerValidateRequest
    ) -> PartnerValidateResponse:
        adapter = _require_adapter(platform)
        org_id = _require_gym_admin(user)
        config = await self._config_repo.get_by_org_platform(org_id, platform)
        if config is None or not config.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No active {platform} configuration for this organization",
            )

        result = await self._client.validate_member(
            adapter=adapter,
            external_member_id=data.external_member_id,
            bearer_token=config.bearer_token,
            external_gym_id=config.external_gym_id,
        )
        if result is None:
            return PartnerValidateResponse(
                recorded=False,
                external_member_id=data.external_member_id,
                message=f"{platform} member validation failed or member is inactive",
            )

        member = await self._member_repo.get_by_external_id(
            org_id, platform, data.external_member_id
        )
        recorded = False
        if member:
            checked_in_at = datetime.now(UTC)
            today = checked_in_at.date()
            already = await self._attendance_repo.already_checked_in_today(
                organization_id=org_id,
                user_id=member.user_id,
                today=today,
                source=platform,
            )
            if not already:
                await self._attendance_repo.create(
                    organization_id=org_id,
                    user_id=member.user_id,
                    checked_in_at=checked_in_at,
                    source=platform,
                    external_ref=None,
                )
                recorded = True

        return PartnerValidateResponse(
            recorded=recorded,
            external_member_id=data.external_member_id,
            message=(
                "Member validated"
                if recorded
                else (
                    "Member validated (attendance not recorded"
                    " — no local mapping or already checked in today)"
                )
            ),
        )
