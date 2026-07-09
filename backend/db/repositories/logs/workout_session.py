import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.logs.workout_session import WorkoutSession


class WorkoutSessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def get_by_id(
        self,
        session_id: uuid.UUID,
        *,
        organization_id: uuid.UUID | None,
        athlete_id: uuid.UUID,
    ) -> WorkoutSession | None:
        conditions = [
            WorkoutSession.id == session_id,
            WorkoutSession.athlete_id == athlete_id,
        ]
        if organization_id is not None:
            conditions.append(WorkoutSession.organization_id == organization_id)
        result = await self._s.execute(select(WorkoutSession).where(*conditions))
        return result.scalar_one_or_none()

    async def get_active(
        self,
        *,
        organization_id: uuid.UUID | None,
        athlete_id: uuid.UUID,
    ) -> WorkoutSession | None:
        conditions = [
            WorkoutSession.athlete_id == athlete_id,
            WorkoutSession.finished_at.is_(None),
        ]
        if organization_id is not None:
            conditions.append(WorkoutSession.organization_id == organization_id)
        result = await self._s.execute(select(WorkoutSession).where(*conditions))
        return result.scalar_one_or_none()

    async def list_for_athlete(
        self,
        *,
        organization_id: uuid.UUID | None,
        athlete_id: uuid.UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> list[WorkoutSession]:
        conditions = [
            WorkoutSession.athlete_id == athlete_id,
            WorkoutSession.finished_at.is_not(None),
        ]
        if organization_id is not None:
            conditions.append(WorkoutSession.organization_id == organization_id)
        result = await self._s.execute(
            select(WorkoutSession)
            .where(*conditions)
            .order_by(WorkoutSession.started_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def create(
        self,
        *,
        organization_id: uuid.UUID | None,
        athlete_id: uuid.UUID,
        program_day_id: uuid.UUID | None,
        name: str,
        mode: str,
        day_tag: str | None = None,
    ) -> WorkoutSession:
        ws = WorkoutSession(
            organization_id=organization_id,
            athlete_id=athlete_id,
            program_day_id=program_day_id,
            name=name,
            mode=mode,
            day_tag=day_tag,
        )
        self._s.add(ws)
        await self._s.commit()
        await self._s.refresh(ws)
        return ws

    async def finish(
        self,
        session: WorkoutSession,
        *,
        notes: str | None = None,
        perceived_difficulty: int | None = None,
    ) -> WorkoutSession:
        session.finished_at = datetime.now(UTC)
        if notes is not None:
            session.notes = notes
        if perceived_difficulty is not None:
            session.perceived_difficulty = perceived_difficulty
        await self._s.commit()
        await self._s.refresh(session)
        return session

    async def delete(self, session: WorkoutSession) -> None:
        await self._s.delete(session)
        await self._s.commit()
