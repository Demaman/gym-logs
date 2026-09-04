import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.api_key_auth import require_scope
from core.database import get_db
from modules.integrations.schemas import (
    AttendanceWebhookRequest,
    AttendanceWebhookResponse,
)
from modules.integrations.services import IntegrationService
from modules.integrations.partners.router import router as partners_router

router = APIRouter(prefix="/integrations", tags=["integrations"])
router.include_router(partners_router)


def _svc(db: AsyncSession = Depends(get_db)) -> IntegrationService:
    return IntegrationService(db)


@router.post(
    "/attendance/checkin",
    response_model=AttendanceWebhookResponse,
    summary="External attendance check-in",
    description=(
        "Record a member check-in from an external platform "
        "(Wellhub, TotalPass, Sesi, etc.). "
        "Requires an API key with the `attendance:write` scope. "
        "Idempotent per member per day per source — a second call on the same day "
        "returns `recorded: false` without creating a duplicate."
    ),
)
async def webhook_checkin(
    data: AttendanceWebhookRequest,
    ctx: Annotated[dict, require_scope("attendance:write")],
    svc: IntegrationService = Depends(_svc),
) -> AttendanceWebhookResponse:
    org_id = uuid.UUID(ctx["organization_id"])
    return await svc.record_attendance(org_id, data)
