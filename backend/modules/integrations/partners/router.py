from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import CurrentUser
from core.database import get_db
from modules.integrations.partners.adapters import get_adapter, supported_platforms
from modules.integrations.partners.schemas import (
    PartnerConfigCreate,
    PartnerConfigResponse,
    PartnerLinkMemberRequest,
    PartnerMemberResponse,
    PartnerValidateRequest,
    PartnerValidateResponse,
    PartnerWebhookResponse,
)
from modules.integrations.partners.services import PartnerService

router = APIRouter(prefix="/partners", tags=["partners"])


def _svc(db: AsyncSession = Depends(get_db)) -> PartnerService:
    return PartnerService(db)


def _validate_platform(platform: str) -> str:
    """Dependency: raise 400 for unknown platforms."""
    if get_adapter(platform) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported platform: {platform!r}. "
            f"Supported: {supported_platforms()}",
        )
    return platform


@router.get(
    "",
    summary="List supported wellness platforms",
)
async def list_platforms() -> dict:
    return {"platforms": supported_platforms()}


@router.post(
    "/{platform}/webhook",
    response_model=PartnerWebhookResponse,
    summary="Inbound partner check-in webhook",
    description=(
        "Receives a member check-in from a wellness platform. No JWT required — "
        "authenticated via HMAC-SHA256 signature on the raw request body."
    ),
)
async def partner_webhook(
    platform: str,
    request: Request,
    svc: PartnerService = Depends(_svc),
) -> PartnerWebhookResponse:
    _validate_platform(platform)
    adapter = get_adapter(platform)
    body = await request.body()
    signature = request.headers.get(adapter.signature_header, "")  # type: ignore[union-attr]
    return await svc.handle_webhook_raw(platform, body, signature)


@router.put(
    "/{platform}/config",
    response_model=PartnerConfigResponse,
    summary="Configure a partner platform integration",
)
async def configure_partner(
    platform: str,
    data: PartnerConfigCreate,
    user: CurrentUser,
    svc: PartnerService = Depends(_svc),
) -> PartnerConfigResponse:
    return await svc.configure(user, platform, data)


@router.get(
    "/{platform}/config",
    response_model=PartnerConfigResponse,
    summary="Get partner platform integration config",
)
async def get_partner_config(
    platform: str,
    user: CurrentUser,
    svc: PartnerService = Depends(_svc),
) -> PartnerConfigResponse:
    return await svc.get_config(user, platform)


@router.post(
    "/{platform}/members",
    response_model=PartnerMemberResponse,
    status_code=201,
    summary="Link an athlete to their partner platform member ID",
)
async def link_partner_member(
    platform: str,
    data: PartnerLinkMemberRequest,
    user: CurrentUser,
    svc: PartnerService = Depends(_svc),
) -> PartnerMemberResponse:
    return await svc.link_member(user, platform, data)


@router.delete(
    "/{platform}/members/{user_id}",
    status_code=204,
    summary="Unlink an athlete from a partner platform",
)
async def unlink_partner_member(
    platform: str,
    user_id: str,
    user: CurrentUser,
    svc: PartnerService = Depends(_svc),
) -> None:
    await svc.unlink_member(user, platform, user_id)


@router.get(
    "/{platform}/members",
    response_model=list[PartnerMemberResponse],
    summary="List all partner member mappings for this org",
)
async def list_partner_members(
    platform: str,
    user: CurrentUser,
    svc: PartnerService = Depends(_svc),
) -> list[PartnerMemberResponse]:
    return await svc.list_members(user, platform)


@router.post(
    "/{platform}/validate",
    response_model=PartnerValidateResponse,
    summary="Outbound partner member validation",
    description=(
        "Calls the partner platform API to verify the member is active, then records "
        "attendance if a local mapping exists. "
        "Not available for webhook-only platforms."
    ),
)
async def validate_partner_member(
    platform: str,
    data: PartnerValidateRequest,
    user: CurrentUser,
    svc: PartnerService = Depends(_svc),
) -> PartnerValidateResponse:
    return await svc.validate_member(user, platform, data)
