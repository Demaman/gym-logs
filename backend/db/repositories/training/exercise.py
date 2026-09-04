import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.training.exercise import Exercise


class ExerciseRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def get_by_id(self, exercise_id: uuid.UUID) -> Exercise | None:
        result = await self._s.execute(
            select(Exercise).where(Exercise.id == exercise_id)
        )
        return result.scalar_one_or_none()

    async def get_by_ids(
        self, exercise_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, "Exercise"]:
        if not exercise_ids:
            return {}
        result = await self._s.execute(
            select(Exercise).where(Exercise.id.in_(exercise_ids))
        )
        return {ex.id: ex for ex in result.scalars().all()}

    async def search(
        self,
        organization_id: uuid.UUID | None,
        *,
        query: str | None = None,
        muscle_group: str | None = None,
        equipment: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Exercise]:
        stmt = select(Exercise).where(
            or_(
                Exercise.is_global.is_(True),
                Exercise.organization_id == organization_id,
            )
        )
        if query is not None:
            stmt = stmt.where(
                Exercise.name.ilike(f"%{query}%")
            )
        if muscle_group is not None:
            stmt = stmt.where(Exercise.muscle_group == muscle_group)
        if equipment is not None:
            stmt = stmt.where(Exercise.equipment == equipment)
        stmt = (
            stmt.order_by(Exercise.is_global.desc(), Exercise.name.asc())
            .limit(limit)
            .offset(offset)
        )
        result = await self._s.execute(stmt)
        return list(result.scalars().all())

    async def list_for_org(self, organization_id: uuid.UUID) -> list[Exercise]:
        stmt = (
            select(Exercise)
            .where(
                or_(
                    Exercise.is_global.is_(True),
                    Exercise.organization_id == organization_id,
                )
            )
            .order_by(Exercise.name.asc())
        )
        result = await self._s.execute(stmt)
        return list(result.scalars().all())

    async def create(
        self,
        *,
        organization_id: uuid.UUID | None,
        name: str,
        aliases: list[str],
        muscle_group: str,
        secondary_muscles: list[str],
        equipment: str,
        movement_pattern: str,
        is_bilateral: bool,
        is_global: bool,
        created_by_id: uuid.UUID | None,
        notes: str | None,
        demo_video_url: str | None = None,
        battle_coefficient: float = 1.0,
    ) -> Exercise:
        exercise = Exercise(
            organization_id=organization_id,
            name=name,
            aliases=aliases,
            muscle_group=muscle_group,
            secondary_muscles=secondary_muscles,
            equipment=equipment,
            movement_pattern=movement_pattern,
            is_bilateral=is_bilateral,
            is_global=is_global,
            created_by_id=created_by_id,
            notes=notes,
            demo_video_url=demo_video_url,
            battle_coefficient=battle_coefficient,
        )
        self._s.add(exercise)
        await self._s.commit()
        await self._s.refresh(exercise)
        return exercise

    async def update(self, exercise: Exercise, **fields) -> Exercise:
        for key, value in fields.items():
            setattr(exercise, key, value)
        await self._s.commit()
        await self._s.refresh(exercise)
        return exercise

    async def delete(self, exercise: Exercise) -> None:
        await self._s.delete(exercise)
        await self._s.commit()
