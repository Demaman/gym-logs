import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.logs.logged_exercise import LoggedExercise
from db.models.logs.logged_set import LoggedSet
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

    async def save(self, ws: WorkoutSession) -> WorkoutSession:
        self._s.add(ws)
        await self._s.flush()
        return ws

    async def delete(self, session: WorkoutSession) -> None:
        await self._s.delete(session)
        await self._s.commit()

    async def get_by_id_any(self, session_id: uuid.UUID) -> WorkoutSession | None:
        """Fetch a session by ID without org or athlete scope. Used by battle service."""
        result = await self._s.execute(
            select(WorkoutSession).where(WorkoutSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def get_by_id_in_org(
        self,
        session_id: uuid.UUID,
        *,
        organization_id: uuid.UUID,
    ) -> WorkoutSession | None:
        result = await self._s.execute(
            select(WorkoutSession).where(
                WorkoutSession.id == session_id,
                WorkoutSession.organization_id == organization_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_last_finished_for_athlete(
        self,
        *,
        athlete_id: uuid.UUID,
        organization_id: uuid.UUID | None,
    ) -> WorkoutSession | None:
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
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_progress_stats(
        self,
        *,
        organization_id: uuid.UUID | None,
        athlete_id: uuid.UUID,
    ) -> dict:
        session_vol_sq = (
            select(
                LoggedExercise.session_id,
                func.coalesce(
                    func.sum(LoggedSet.weight_kg * LoggedSet.reps).filter(
                        LoggedSet.counts_volume.is_(True)
                    ),
                    0.0,
                ).label("volume"),
            )
            .join(LoggedSet, LoggedSet.logged_exercise_id == LoggedExercise.id)
            .group_by(LoggedExercise.session_id)
            .subquery()
        )
        stmt = (
            select(
                func.count(WorkoutSession.id).label("total_sessions"),
                func.coalesce(
                    func.sum(session_vol_sq.c.volume), 0.0
                ).label("total_volume_kg"),
                func.count(WorkoutSession.id)
                .filter(
                    WorkoutSession.started_at >= func.date_trunc("month", func.now())
                )
                .label("sessions_this_month"),
                func.coalesce(
                    func.avg(session_vol_sq.c.volume), 0.0
                ).label("avg_volume_per_session"),
            )
            .select_from(WorkoutSession)
            .outerjoin(session_vol_sq, session_vol_sq.c.session_id == WorkoutSession.id)
            .where(
                WorkoutSession.athlete_id == athlete_id,
                WorkoutSession.finished_at.is_not(None),
            )
        )
        if organization_id is not None:
            stmt = stmt.where(WorkoutSession.organization_id == organization_id)
        row = (await self._s.execute(stmt)).one()
        return {
            "total_sessions": row.total_sessions or 0,
            "total_volume_kg": float(row.total_volume_kg or 0.0),
            "sessions_this_month": row.sessions_this_month or 0,
            "avg_volume_per_session": float(row.avg_volume_per_session or 0.0),
        }

    async def get_weekly_volume(
        self,
        *,
        organization_id: uuid.UUID | None,
        athlete_id: uuid.UUID,
        weeks: int = 12,
    ) -> list[dict]:
        cutoff = datetime.now(UTC) - timedelta(weeks=weeks)
        # Use literal("week") so SQLAlchemy renders 'week' as a SQL constant rather
        # than a bound parameter — PostgreSQL requires the GROUP BY and ORDER BY
        # expressions to be identical textually when parameters are involved.
        week_trunc = func.date_trunc(literal("week"), WorkoutSession.started_at)
        stmt = (
            select(
                week_trunc.label("week_start"),
                func.coalesce(
                    func.sum(LoggedSet.weight_kg * LoggedSet.reps).filter(
                        LoggedSet.counts_volume.is_(True)
                    ),
                    0.0,
                ).label("volume_kg"),
            )
            .select_from(WorkoutSession)
            .outerjoin(LoggedExercise, LoggedExercise.session_id == WorkoutSession.id)
            .outerjoin(LoggedSet, LoggedSet.logged_exercise_id == LoggedExercise.id)
            .where(
                WorkoutSession.athlete_id == athlete_id,
                WorkoutSession.finished_at.is_not(None),
                WorkoutSession.started_at >= cutoff,
            )
            .group_by(week_trunc)
            .order_by(week_trunc.asc())
        )
        if organization_id is not None:
            stmt = stmt.where(WorkoutSession.organization_id == organization_id)
        rows = (await self._s.execute(stmt)).all()
        return [
            {
                "week_start": row.week_start.date().isoformat(),
                "volume_kg": float(row.volume_kg),
            }
            for row in rows
        ]

    async def get_exercise_history(
        self,
        *,
        organization_id: uuid.UUID | None,
        athlete_id: uuid.UUID,
        catalog_exercise_id: uuid.UUID,
        limit: int = 30,
    ) -> list[dict]:
        stmt = (
            select(
                WorkoutSession.started_at,
                WorkoutSession.name,
                func.max(LoggedSet.weight_kg)
                .filter(LoggedSet.counts_volume.is_(True))
                .label("best_weight_kg"),
                func.coalesce(
                    func.sum(LoggedSet.weight_kg * LoggedSet.reps).filter(
                        LoggedSet.counts_volume.is_(True)
                    ),
                    0.0,
                ).label("volume_kg"),
            )
            .select_from(WorkoutSession)
            .join(LoggedExercise, LoggedExercise.session_id == WorkoutSession.id)
            .join(LoggedSet, LoggedSet.logged_exercise_id == LoggedExercise.id)
            .where(
                WorkoutSession.athlete_id == athlete_id,
                WorkoutSession.finished_at.is_not(None),
                LoggedExercise.exercise_id == catalog_exercise_id,
            )
            .group_by(WorkoutSession.id, WorkoutSession.started_at, WorkoutSession.name)
            .order_by(WorkoutSession.started_at.asc())
            .limit(limit)
        )
        if organization_id is not None:
            stmt = stmt.where(WorkoutSession.organization_id == organization_id)
        rows = (await self._s.execute(stmt)).all()
        return [
            {
                "session_date": row.started_at.date().isoformat(),
                "session_name": row.name,
                "best_weight_kg": (
                    float(row.best_weight_kg)
                    if row.best_weight_kg is not None
                    else None
                ),
                "volume_kg": float(row.volume_kg),
            }
            for row in rows
        ]
