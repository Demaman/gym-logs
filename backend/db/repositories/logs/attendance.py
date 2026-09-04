import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import Date, cast, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.logs.attendance import Attendance


class AttendanceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def create(
        self,
        *,
        organization_id: uuid.UUID | None,
        user_id: uuid.UUID,
        checked_in_at: datetime,
        source: str = "session_log",
        external_ref: str | None = None,
    ) -> Attendance:
        record = Attendance(
            organization_id=organization_id,
            user_id=user_id,
            checked_in_at=checked_in_at,
            source=source,
            external_ref=external_ref,
        )
        self._s.add(record)
        await self._s.commit()
        await self._s.refresh(record)
        return record

    async def already_checked_in_today(
        self,
        *,
        organization_id: uuid.UUID | None,
        user_id: uuid.UUID,
        today: date,
        source: str,
    ) -> bool:
        q = select(Attendance.id).where(
            Attendance.user_id == user_id,
            cast(Attendance.checked_in_at, Date) == today,
            Attendance.source == source,
        )
        if organization_id:
            q = q.where(Attendance.organization_id == organization_id)
        result = await self._s.execute(q.limit(1))
        return result.scalar_one_or_none() is not None

    async def count_unique_today(
        self, *, organization_id: uuid.UUID, today: date
    ) -> int:
        result = await self._s.execute(
            select(func.count(distinct(Attendance.user_id))).where(
                Attendance.organization_id == organization_id,
                cast(Attendance.checked_in_at, Date) == today,
            )
        )
        return result.scalar_one() or 0

    async def count_unique_range(
        self, *, organization_id: uuid.UUID, start: date, end: date
    ) -> int:
        result = await self._s.execute(
            select(func.count(distinct(Attendance.user_id))).where(
                Attendance.organization_id == organization_id,
                cast(Attendance.checked_in_at, Date) >= start,
                cast(Attendance.checked_in_at, Date) <= end,
            )
        )
        return result.scalar_one() or 0

    async def get_heatmap(
        self, *, organization_id: uuid.UUID, since: date
    ) -> list[dict]:
        """Returns [{day_of_week, hour, count}] for the given period."""
        result = await self._s.execute(
            select(
                func.extract("isodow", Attendance.checked_in_at).label("day_of_week"),
                func.extract("hour", Attendance.checked_in_at).label("hour"),
                func.count().label("count"),
            ).where(
                Attendance.organization_id == organization_id,
                cast(Attendance.checked_in_at, Date) >= since,
            ).group_by(
                func.extract("isodow", Attendance.checked_in_at),
                func.extract("hour", Attendance.checked_in_at),
            ).order_by(
                func.extract("isodow", Attendance.checked_in_at),
                func.extract("hour", Attendance.checked_in_at),
            )
        )
        return [
            {"day_of_week": int(r.day_of_week), "hour": int(r.hour), "count": r.count}
            for r in result.all()
        ]

    async def get_per_member_stats(
        self, *, organization_id: uuid.UUID, since: date
    ) -> list[dict]:
        """Returns [{user_id, sessions_count, last_checkin}] for the given period."""
        result = await self._s.execute(
            select(
                Attendance.user_id,
                func.count().label("sessions_count"),
                func.max(Attendance.checked_in_at).label("last_checkin"),
            ).where(
                Attendance.organization_id == organization_id,
                cast(Attendance.checked_in_at, Date) >= since,
            ).group_by(Attendance.user_id)
            .order_by(func.max(Attendance.checked_in_at).desc())
        )
        return [
            {
                "user_id": r.user_id,
                "sessions_count": r.sessions_count,
                "last_checkin": r.last_checkin,
            }
            for r in result.all()
        ]
