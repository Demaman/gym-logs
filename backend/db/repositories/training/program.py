import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.models.training.program import Program
from db.models.training.program_day import ProgramDay
from db.models.training.program_exercise import ProgramExercise


def _with_days() -> list:
    """Return the selectinload options to eagerly fetch days → exercises → prescribed_sets."""
    return [
        selectinload(Program.days).selectinload(ProgramDay.exercises).selectinload(
            ProgramExercise.prescribed_sets
        )
    ]


class ProgramRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def get_by_id(
        self,
        program_id: uuid.UUID,
        organization_id: uuid.UUID | None,
        user_id: uuid.UUID | None = None,
    ) -> Program | None:
        stmt = (
            select(Program)
            .options(*_with_days())
            .where(Program.id == program_id, Program.is_active.is_(True))
        )
        if organization_id is not None:
            stmt = stmt.where(Program.organization_id == organization_id)
        else:
            stmt = stmt.where(Program.organization_id.is_(None))
            if user_id is not None:
                stmt = stmt.where(
                    or_(Program.created_by_id == user_id, Program.athlete_id == user_id)
                )
        result = await self._s.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_org(
        self, organization_id: uuid.UUID, *, active_only: bool = True
    ) -> list[Program]:
        stmt = (
            select(Program)
            .options(*_with_days())
            .where(Program.organization_id == organization_id)
        )
        if active_only:
            stmt = stmt.where(Program.is_active.is_(True))
        result = await self._s.execute(stmt)
        return list(result.scalars().all())

    async def list_for_athlete(
        self, athlete_id: uuid.UUID, organization_id: uuid.UUID | None
    ) -> list[Program]:
        stmt = (
            select(Program)
            .options(*_with_days())
            .where(Program.athlete_id == athlete_id, Program.is_active.is_(True))
        )
        if organization_id is not None:
            stmt = stmt.where(Program.organization_id == organization_id)
        else:
            stmt = stmt.where(Program.organization_id.is_(None))
        result = await self._s.execute(stmt)
        return list(result.scalars().all())

    async def list_for_trainer(
        self, trainer_id: uuid.UUID, organization_id: uuid.UUID | None
    ) -> list[Program]:
        stmt = (
            select(Program)
            .options(*_with_days())
            .where(
                or_(
                    Program.athlete_id == trainer_id,
                    Program.created_by_id == trainer_id,
                ),
                Program.is_active.is_(True),
            )
        )
        if organization_id is not None:
            stmt = stmt.where(Program.organization_id == organization_id)
        else:
            stmt = stmt.where(Program.organization_id.is_(None))
        result = await self._s.execute(stmt)
        return list(result.scalars().all())

    async def create(
        self,
        *,
        organization_id: uuid.UUID | None,
        athlete_id: uuid.UUID | None,
        name: str,
        description: str | None,
        mode: str,
        created_by_id: uuid.UUID,
    ) -> Program:
        program = Program(
            organization_id=organization_id,
            athlete_id=athlete_id,
            name=name,
            description=description,
            mode=mode,
            created_by_id=created_by_id,
        )
        self._s.add(program)
        await self._s.commit()
        # Re-fetch with eager loading so the days relationship is populated
        await self._s.refresh(program)
        result = await self._s.execute(
            select(Program).options(*_with_days()).where(Program.id == program.id)
        )
        return result.scalar_one()

    async def update(self, program: Program, **fields) -> Program:
        for key, value in fields.items():
            setattr(program, key, value)
        await self._s.commit()
        result = await self._s.execute(
            select(Program).options(*_with_days()).where(Program.id == program.id)
        )
        return result.scalar_one()

    async def soft_delete(self, program: Program) -> None:
        program.is_active = False
        await self._s.commit()
