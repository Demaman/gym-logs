import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.logs.logged_set import LoggedSet


class LoggedSetRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def get_by_id(self, set_id: uuid.UUID) -> LoggedSet | None:
        result = await self._s.execute(
            select(LoggedSet).where(LoggedSet.id == set_id)
        )
        return result.scalar_one_or_none()

    async def list_for_exercise(
        self, logged_exercise_id: uuid.UUID
    ) -> list[LoggedSet]:
        result = await self._s.execute(
            select(LoggedSet)
            .where(LoggedSet.logged_exercise_id == logged_exercise_id)
            .order_by(LoggedSet.position.asc())
        )
        return list(result.scalars().all())

    async def create(
        self,
        *,
        logged_exercise_id: uuid.UUID,
        position: int,
        set_type: str,
        weight_kg: float,
        reps: int,
        counts_volume: bool,
        rpe: float | None = None,
        rir: int | None = None,
        is_to_failure: bool = False,
        tempo: str | None = None,
        notes: str | None = None,
    ) -> LoggedSet:
        logged_set = LoggedSet(
            logged_exercise_id=logged_exercise_id,
            position=position,
            set_type=set_type,
            weight_kg=weight_kg,
            reps=reps,
            counts_volume=counts_volume,
            rpe=rpe,
            rir=rir,
            is_to_failure=is_to_failure,
            tempo=tempo,
            notes=notes,
        )
        self._s.add(logged_set)
        await self._s.commit()
        await self._s.refresh(logged_set)
        return logged_set

    async def update(self, logged_set: LoggedSet, **fields: object) -> LoggedSet:
        for key, value in fields.items():
            setattr(logged_set, key, value)
        await self._s.commit()
        await self._s.refresh(logged_set)
        return logged_set

    async def delete(self, logged_set: LoggedSet) -> None:
        await self._s.delete(logged_set)
        await self._s.commit()
