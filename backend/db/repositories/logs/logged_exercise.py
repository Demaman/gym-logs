import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.logs.logged_exercise import LoggedExercise


class LoggedExerciseRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def list_for_session(
        self, session_id: uuid.UUID
    ) -> list[LoggedExercise]:
        result = await self._s.execute(
            select(LoggedExercise)
            .where(LoggedExercise.session_id == session_id)
            .order_by(LoggedExercise.position.asc())
        )
        return list(result.scalars().all())

    async def create(
        self,
        *,
        session_id: uuid.UUID,
        exercise_id: uuid.UUID | None,
        exercise_name_free: str | None,
        position: int,
        notes: str | None = None,
    ) -> LoggedExercise:
        ex = LoggedExercise(
            session_id=session_id,
            exercise_id=exercise_id,
            exercise_name_free=exercise_name_free,
            position=position,
            notes=notes,
        )
        self._s.add(ex)
        await self._s.commit()
        await self._s.refresh(ex)
        return ex

    async def update(self, ex: LoggedExercise, **fields: object) -> LoggedExercise:
        for key, value in fields.items():
            setattr(ex, key, value)
        await self._s.commit()
        await self._s.refresh(ex)
        return ex

    async def reorder(
        self,
        exercises: list[LoggedExercise],
        new_positions: list[int],
    ) -> list[LoggedExercise]:
        for ex, pos in zip(exercises, new_positions):
            ex.position = pos
        await self._s.commit()
        for ex in exercises:
            await self._s.refresh(ex)
        return exercises

    async def delete(self, ex: LoggedExercise) -> None:
        await self._s.delete(ex)
        await self._s.commit()

    async def get_last_for_catalog_exercise(
        self,
        *,
        athlete_id: uuid.UUID,
        catalog_exercise_id: uuid.UUID,
    ) -> tuple["LoggedExercise", str, datetime] | None:
        """Most recent finished session's LoggedExercise for this catalog exercise."""
        from db.models.logs.workout_session import WorkoutSession

        result = await self._s.execute(
            select(LoggedExercise, WorkoutSession.name, WorkoutSession.started_at)
            .join(WorkoutSession, WorkoutSession.id == LoggedExercise.session_id)
            .where(
                LoggedExercise.exercise_id == catalog_exercise_id,
                WorkoutSession.athlete_id == athlete_id,
                WorkoutSession.finished_at.is_not(None),
            )
            .order_by(WorkoutSession.started_at.desc())
            .limit(1)
        )
        row = result.first()
        if row is None:
            return None
        return row[0], row[1], row[2]
