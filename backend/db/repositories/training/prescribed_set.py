import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.training.prescribed_set import PrescribedSet


class PrescribedSetRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def list_for_program_exercise(
        self, program_exercise_id: uuid.UUID
    ) -> list[PrescribedSet]:
        result = await self._s.execute(
            select(PrescribedSet)
            .where(PrescribedSet.program_exercise_id == program_exercise_id)
            .order_by(PrescribedSet.position.asc())
        )
        return list(result.scalars().all())

    async def create(
        self,
        *,
        program_exercise_id: uuid.UUID,
        position: int,
        set_type: str,
        rep_min: int,
        rep_max: int,
        rpe_target: float | None,
        rest_seconds: int | None,
        weight_pct_1rm: float | None,
        notes: str | None,
    ) -> PrescribedSet:
        ps = PrescribedSet(
            program_exercise_id=program_exercise_id,
            position=position,
            set_type=set_type,
            rep_min=rep_min,
            rep_max=rep_max,
            rpe_target=rpe_target,
            rest_seconds=rest_seconds,
            weight_pct_1rm=weight_pct_1rm,
            notes=notes,
        )
        self._s.add(ps)
        await self._s.commit()
        await self._s.refresh(ps)
        return ps

    async def update(self, ps: PrescribedSet, **fields) -> PrescribedSet:
        for key, value in fields.items():
            setattr(ps, key, value)
        await self._s.commit()
        await self._s.refresh(ps)
        return ps

    async def bulk_replace(
        self, program_exercise_id: uuid.UUID, new_sets: list[dict]
    ) -> list[PrescribedSet]:
        await self._s.execute(
            delete(PrescribedSet).where(
                PrescribedSet.program_exercise_id == program_exercise_id
            )
        )
        created: list[PrescribedSet] = []
        for position, set_data in enumerate(new_sets):
            ps = PrescribedSet(
                program_exercise_id=program_exercise_id,
                position=position,
                **set_data,
            )
            self._s.add(ps)
            created.append(ps)
        await self._s.commit()
        for ps in created:
            await self._s.refresh(ps)
        return created

    async def delete(self, ps: PrescribedSet) -> None:
        await self._s.delete(ps)
        await self._s.commit()
