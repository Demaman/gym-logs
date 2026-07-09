import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.events import publish
from db.repositories.training import (
    ExerciseRepository,
    PrescribedSetRepository,
    ProgramDayRepository,
    ProgramExerciseRepository,
    ProgramRepository,
)
from modules.training.schemas import (
    ExerciseCreate,
    ExerciseResponse,
    ExerciseUpdate,
    PrescribedSetCreate,
    PrescribedSetResponse,
    ProgramCreate,
    ProgramDayCreate,
    ProgramDayResponse,
    ProgramDayUpdate,
    ProgramExerciseCreate,
    ProgramExerciseResponse,
    ProgramResponse,
    ProgramUpdate,
)


class ExerciseService:
    def __init__(self, session: AsyncSession) -> None:
        self._repo = ExerciseRepository(session)

    async def search(
        self,
        current_user: dict,
        *,
        query: str | None = None,
        muscle_group: str | None = None,
        equipment: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[ExerciseResponse]:
        org_id = (
            uuid.UUID(current_user["organization_id"])
            if current_user.get("organization_id")
            else None
        )
        exercises = await self._repo.search(
            org_id,
            query=query,
            muscle_group=muscle_group,
            equipment=equipment,
            limit=limit,
            offset=offset,
        )
        return [ExerciseResponse.model_validate(e) for e in exercises]

    async def create(
        self, current_user: dict, data: ExerciseCreate
    ) -> ExerciseResponse:
        org_id = (
            uuid.UUID(current_user["organization_id"])
            if current_user.get("organization_id")
            else None
        )
        user_id = uuid.UUID(current_user["user_id"])
        ex = await self._repo.create(
            organization_id=org_id,
            name=data.name,
            aliases=data.aliases,
            muscle_group=data.muscle_group,
            secondary_muscles=data.secondary_muscles,
            equipment=data.equipment,
            movement_pattern=data.movement_pattern,
            is_bilateral=data.is_bilateral,
            is_global=False,
            created_by_id=user_id,
            notes=data.notes,
        )
        return ExerciseResponse.model_validate(ex)

    async def get(self, exercise_id: uuid.UUID) -> ExerciseResponse:
        ex = await self._repo.get_by_id(exercise_id)
        if not ex:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")
        return ExerciseResponse.model_validate(ex)

    async def update(
        self, current_user: dict, exercise_id: uuid.UUID, data: ExerciseUpdate
    ) -> ExerciseResponse:
        ex = await self._repo.get_by_id(exercise_id)
        if not ex:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")
        if str(ex.created_by_id) != current_user["user_id"] and current_user[
            "role"
        ] != "gym_admin":
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Not authorized to modify this exercise"
            )
        updates = data.model_dump(exclude_none=True)
        ex = await self._repo.update(ex, **updates)
        return ExerciseResponse.model_validate(ex)

    async def delete(self, current_user: dict, exercise_id: uuid.UUID) -> None:
        ex = await self._repo.get_by_id(exercise_id)
        if not ex:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")
        if str(ex.created_by_id) != current_user["user_id"] and current_user[
            "role"
        ] != "gym_admin":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")
        await self._repo.delete(ex)


class ProgramService:
    def __init__(self, session: AsyncSession) -> None:
        self._program_repo = ProgramRepository(session)
        self._day_repo = ProgramDayRepository(session)
        self._ex_repo = ProgramExerciseRepository(session)
        self._set_repo = PrescribedSetRepository(session)

    def _org_id(self, current_user: dict) -> uuid.UUID:
        org_id = current_user.get("organization_id")
        if not org_id:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Programs require an organization context",
            )
        return uuid.UUID(org_id)

    def _user_id(self, current_user: dict) -> uuid.UUID:
        return uuid.UUID(current_user["user_id"])

    async def create(
        self, current_user: dict, data: ProgramCreate
    ) -> ProgramResponse:
        org_id = self._org_id(current_user)
        athlete_id = data.athlete_id or self._user_id(current_user)
        if data.athlete_id and data.athlete_id != self._user_id(current_user):
            if current_user["role"] not in ("trainer", "gym_admin"):
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    "Only trainers can create programs for athletes",
                )
        program = await self._program_repo.create(
            organization_id=org_id,
            athlete_id=athlete_id,
            name=data.name,
            description=data.description,
            mode=data.mode,
            created_by_id=self._user_id(current_user),
        )
        await publish(
            "program.created",
            {
                "program_id": str(program.id),
                "athlete_id": str(program.athlete_id),
                "organization_id": str(program.organization_id),
            },
        )
        return ProgramResponse.model_validate(program)

    async def get(
        self, current_user: dict, program_id: uuid.UUID
    ) -> ProgramResponse:
        org_id = self._org_id(current_user)
        p = await self._program_repo.get_by_id(program_id, organization_id=org_id)
        if not p:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Program not found")
        return ProgramResponse.model_validate(p)

    async def list_for_user(self, current_user: dict) -> list[ProgramResponse]:
        org_id = self._org_id(current_user)
        user_id = self._user_id(current_user)
        if current_user["role"] == "gym_admin":
            programs = await self._program_repo.list_for_org(org_id)
        else:
            programs = await self._program_repo.list_for_athlete(user_id, org_id)
        return [ProgramResponse.model_validate(p) for p in programs]

    async def update(
        self, current_user: dict, program_id: uuid.UUID, data: ProgramUpdate
    ) -> ProgramResponse:
        org_id = self._org_id(current_user)
        p = await self._program_repo.get_by_id(program_id, organization_id=org_id)
        if not p:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Program not found")
        if (
            str(p.created_by_id) != current_user["user_id"]
            and current_user["role"] != "gym_admin"
        ):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")
        p = await self._program_repo.update(p, **data.model_dump(exclude_none=True))
        return ProgramResponse.model_validate(p)

    async def delete(self, current_user: dict, program_id: uuid.UUID) -> None:
        org_id = self._org_id(current_user)
        p = await self._program_repo.get_by_id(program_id, organization_id=org_id)
        if not p:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Program not found")
        if (
            str(p.created_by_id) != current_user["user_id"]
            and current_user["role"] != "gym_admin"
        ):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")
        await self._program_repo.soft_delete(p)

    async def add_day(
        self, current_user: dict, program_id: uuid.UUID, data: ProgramDayCreate
    ) -> ProgramDayResponse:
        org_id = self._org_id(current_user)
        p = await self._program_repo.get_by_id(program_id, organization_id=org_id)
        if not p:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Program not found")
        day = await self._day_repo.create(
            program_id=program_id,
            name=data.name,
            position=data.position,
            day_tag=data.day_tag,
        )
        return ProgramDayResponse.model_validate(day)

    async def update_day(
        self, current_user: dict, day_id: uuid.UUID, data: ProgramDayUpdate
    ) -> ProgramDayResponse:
        day = await self._day_repo.get_by_id(day_id)
        if not day:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Program day not found")
        day = await self._day_repo.update(day, **data.model_dump(exclude_none=True))
        return ProgramDayResponse.model_validate(day)

    async def delete_day(self, day_id: uuid.UUID) -> None:
        day = await self._day_repo.get_by_id(day_id)
        if not day:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Program day not found")
        await self._day_repo.delete(day)

    async def add_exercise(
        self, current_user: dict, day_id: uuid.UUID, data: ProgramExerciseCreate
    ) -> ProgramExerciseResponse:
        day = await self._day_repo.get_by_id(day_id)
        if not day:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Program day not found")
        ex = await self._ex_repo.create(
            program_day_id=day_id,
            exercise_id=data.exercise_id,
            position=data.position,
            notes=data.notes,
        )
        return ProgramExerciseResponse.model_validate(ex)

    async def delete_exercise(self, ex_id: uuid.UUID) -> None:
        ex = await self._ex_repo.get_by_id(ex_id)
        if not ex:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, "Program exercise not found"
            )
        await self._ex_repo.delete(ex)

    async def add_prescribed_set(
        self, ex_id: uuid.UUID, data: PrescribedSetCreate
    ) -> PrescribedSetResponse:
        ex = await self._ex_repo.get_by_id(ex_id)
        if not ex:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, "Program exercise not found"
            )
        ps = await self._set_repo.create(
            program_exercise_id=ex_id,
            position=data.position,
            set_type=data.set_type,
            rep_min=data.rep_min,
            rep_max=data.rep_max,
            rpe_target=data.rpe_target,
            rest_seconds=data.rest_seconds,
            weight_pct_1rm=data.weight_pct_1rm,
            notes=data.notes,
        )
        return PrescribedSetResponse.model_validate(ps)
