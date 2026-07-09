import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.training.program_exercise import ProgramExercise


class ProgramExerciseRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def get_by_id(self, ex_id: uuid.UUID) -> ProgramExercise | None:
        result = await self._s.execute(
            select(ProgramExercise).where(ProgramExercise.id == ex_id)
        )
        return result.scalar_one_or_none()

    async def list_for_day(
        self, program_day_id: uuid.UUID
    ) -> list[ProgramExercise]:
        result = await self._s.execute(
            select(ProgramExercise)
            .where(ProgramExercise.program_day_id == program_day_id)
            .order_by(ProgramExercise.position.asc())
        )
        return list(result.scalars().all())

    async def create(
        self,
        *,
        program_day_id: uuid.UUID,
        exercise_id: uuid.UUID,
        position: int,
        notes: str | None,
    ) -> ProgramExercise:
        ex = ProgramExercise(
            program_day_id=program_day_id,
            exercise_id=exercise_id,
            position=position,
            notes=notes,
        )
        self._s.add(ex)
        await self._s.commit()
        await self._s.refresh(ex)
        return ex

    async def update(self, ex: ProgramExercise, **fields) -> ProgramExercise:
        for key, value in fields.items():
            setattr(ex, key, value)
        await self._s.commit()
        await self._s.refresh(ex)
        return ex

    async def delete(self, ex: ProgramExercise) -> None:
        await self._s.delete(ex)
        await self._s.commit()
