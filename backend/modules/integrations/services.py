import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from db.repositories.identity import UserRepository
from db.repositories.logs import AttendanceRepository
from modules.integrations.schemas import (
    AttendanceWebhookRequest,
    AttendanceWebhookResponse,
)


class IntegrationService:
    def __init__(self, session: AsyncSession) -> None:
        self._user_repo = UserRepository(session)
        self._attendance_repo = AttendanceRepository(session)

    async def record_attendance(
        self,
        organization_id: uuid.UUID,
        data: AttendanceWebhookRequest,
    ) -> AttendanceWebhookResponse:
        user = await self._user_repo.get_by_email_and_org(data.email, organization_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    f"No member with email '{data.email}' found in this organization"
                ),
            )

        checked_in_at = data.checked_in_at or datetime.now(UTC)
        # Ensure timezone-aware
        if checked_in_at.tzinfo is None:
            checked_in_at = checked_in_at.replace(tzinfo=UTC)

        today = checked_in_at.date()
        already = await self._attendance_repo.already_checked_in_today(
            organization_id=organization_id,
            user_id=user.id,
            today=today,
            source=data.source,
        )

        if already:
            return AttendanceWebhookResponse(
                recorded=False,
                user_id=user.id,
                message="Already checked in today via this platform",
            )

        await self._attendance_repo.create(
            organization_id=organization_id,
            user_id=user.id,
            checked_in_at=checked_in_at,
            source=data.source,
            external_ref=data.external_ref,
        )

        return AttendanceWebhookResponse(
            recorded=True,
            user_id=user.id,
            message="Attendance recorded",
        )
