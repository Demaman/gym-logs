import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.training.program_day import ProgramDay


class ProgramDayRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def get_by_id(self, day_id: uuid.UUID) -> ProgramDay | None:
        result = await self._s.execute(
            select(ProgramDay).where(ProgramDay.id == day_id)
        )
        return result.scalar_one_or_none()

    async def list_for_program(self, program_id: uuid.UUID) -> list[ProgramDay]:
        result = await self._s.execute(
            select(ProgramDay)
            .where(ProgramDay.program_id == program_id)
            .order_by(ProgramDay.position.asc())
        )
        return list(result.scalars().all())

    async def create(
        self,
        *,
        program_id: uuid.UUID,
        name: str,
        position: int,
        day_tag: str,
    ) -> ProgramDay:
        day = ProgramDay(
            program_id=program_id,
            name=name,
            position=position,
            day_tag=day_tag,
        )
        self._s.add(day)
        await self._s.commit()
        await self._s.refresh(day)
        return day

    async def update(self, day: ProgramDay, **fields) -> ProgramDay:
        for key, value in fields.items():
            setattr(day, key, value)
        await self._s.commit()
        await self._s.refresh(day)
        return day

    async def reorder(
        self, days: list[ProgramDay], new_positions: list[int]
    ) -> list[ProgramDay]:
        for day, position in zip(days, new_positions):
            day.position = position
        await self._s.commit()
        for day in days:
            await self._s.refresh(day)
        return days

    async def delete(self, day: ProgramDay) -> None:
        await self._s.delete(day)
        await self._s.commit()
