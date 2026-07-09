import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.training.program import Program


class ProgramRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def get_by_id(
        self, program_id: uuid.UUID, organization_id: uuid.UUID
    ) -> Program | None:
        result = await self._s.execute(
            select(Program).where(
                Program.id == program_id,
                Program.organization_id == organization_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_for_org(
        self, organization_id: uuid.UUID, *, active_only: bool = True
    ) -> list[Program]:
        stmt = select(Program).where(Program.organization_id == organization_id)
        if active_only:
            stmt = stmt.where(Program.is_active.is_(True))
        result = await self._s.execute(stmt)
        return list(result.scalars().all())

    async def list_for_athlete(
        self, athlete_id: uuid.UUID, organization_id: uuid.UUID
    ) -> list[Program]:
        result = await self._s.execute(
            select(Program).where(
                Program.athlete_id == athlete_id,
                Program.organization_id == organization_id,
            )
        )
        return list(result.scalars().all())

    async def create(
        self,
        *,
        organization_id: uuid.UUID,
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
        await self._s.refresh(program)
        return program

    async def update(self, program: Program, **fields) -> Program:
        for key, value in fields.items():
            setattr(program, key, value)
        await self._s.commit()
        await self._s.refresh(program)
        return program

    async def soft_delete(self, program: Program) -> None:
        program.is_active = False
        await self._s.commit()
