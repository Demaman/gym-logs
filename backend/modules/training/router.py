import uuid

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import CurrentUser
from core.database import get_db
from modules.training.schemas import (
    BulkAssignRequest,
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
from modules.training.services import ExerciseService, ProgramService

router = APIRouter(prefix="/training", tags=["training"])


def _exercise_svc(db: AsyncSession = Depends(get_db)) -> ExerciseService:
    return ExerciseService(db)


def _program_svc(db: AsyncSession = Depends(get_db)) -> ProgramService:
    return ProgramService(db)


# ---------------------------------------------------------------------------
# Exercise endpoints
# ---------------------------------------------------------------------------


@router.get("/exercises", response_model=list[ExerciseResponse])
async def search_exercises(
    current_user: CurrentUser,
    query: str | None = Query(default=None),
    muscle_group: str | None = Query(default=None),
    equipment: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    svc: ExerciseService = Depends(_exercise_svc),
) -> list[ExerciseResponse]:
    return await svc.search(
        current_user,
        query=query,
        muscle_group=muscle_group,
        equipment=equipment,
        limit=limit,
        offset=offset,
    )


@router.post("/exercises", response_model=ExerciseResponse, status_code=201)
async def create_exercise(
    data: ExerciseCreate,
    current_user: CurrentUser,
    svc: ExerciseService = Depends(_exercise_svc),
) -> ExerciseResponse:
    return await svc.create(current_user, data)


@router.get("/exercises/{exercise_id}", response_model=ExerciseResponse)
async def get_exercise(
    exercise_id: uuid.UUID,
    current_user: CurrentUser,
    svc: ExerciseService = Depends(_exercise_svc),
) -> ExerciseResponse:
    return await svc.get(exercise_id)


@router.put("/exercises/{exercise_id}", response_model=ExerciseResponse)
async def update_exercise(
    exercise_id: uuid.UUID,
    data: ExerciseUpdate,
    current_user: CurrentUser,
    svc: ExerciseService = Depends(_exercise_svc),
) -> ExerciseResponse:
    return await svc.update(current_user, exercise_id, data)


@router.delete("/exercises/{exercise_id}", status_code=204)
async def delete_exercise(
    exercise_id: uuid.UUID,
    current_user: CurrentUser,
    svc: ExerciseService = Depends(_exercise_svc),
) -> Response:
    await svc.delete(current_user, exercise_id)
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Program endpoints
# ---------------------------------------------------------------------------


@router.get("/programs", response_model=list[ProgramResponse])
async def list_programs(
    current_user: CurrentUser,
    svc: ProgramService = Depends(_program_svc),
) -> list[ProgramResponse]:
    return await svc.list_for_user(current_user)


@router.post("/programs", response_model=ProgramResponse, status_code=201)
async def create_program(
    data: ProgramCreate,
    current_user: CurrentUser,
    svc: ProgramService = Depends(_program_svc),
) -> ProgramResponse:
    return await svc.create(current_user, data)


@router.get("/programs/{program_id}", response_model=ProgramResponse)
async def get_program(
    program_id: uuid.UUID,
    current_user: CurrentUser,
    svc: ProgramService = Depends(_program_svc),
) -> ProgramResponse:
    return await svc.get(current_user, program_id)


@router.put("/programs/{program_id}", response_model=ProgramResponse)
async def update_program(
    program_id: uuid.UUID,
    data: ProgramUpdate,
    current_user: CurrentUser,
    svc: ProgramService = Depends(_program_svc),
) -> ProgramResponse:
    return await svc.update(current_user, program_id, data)


@router.post("/programs/{program_id}/assign", response_model=list[ProgramResponse], status_code=201)
async def assign_program_to_athletes(
    program_id: uuid.UUID,
    data: BulkAssignRequest,
    current_user: CurrentUser,
    svc: ProgramService = Depends(_program_svc),
) -> list[ProgramResponse]:
    return await svc.bulk_assign(current_user, program_id, data.athlete_ids)


@router.delete("/programs/{program_id}", status_code=204)
async def delete_program(
    program_id: uuid.UUID,
    current_user: CurrentUser,
    svc: ProgramService = Depends(_program_svc),
) -> Response:
    await svc.delete(current_user, program_id)
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Program day endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/programs/{program_id}/days",
    response_model=ProgramDayResponse,
    status_code=201,
)
async def add_program_day(
    program_id: uuid.UUID,
    data: ProgramDayCreate,
    current_user: CurrentUser,
    svc: ProgramService = Depends(_program_svc),
) -> ProgramDayResponse:
    return await svc.add_day(current_user, program_id, data)


@router.put("/days/{day_id}", response_model=ProgramDayResponse)
async def update_program_day(
    day_id: uuid.UUID,
    data: ProgramDayUpdate,
    current_user: CurrentUser,
    svc: ProgramService = Depends(_program_svc),
) -> ProgramDayResponse:
    return await svc.update_day(current_user, day_id, data)


@router.delete("/days/{day_id}", status_code=204)
async def delete_program_day(
    day_id: uuid.UUID,
    current_user: CurrentUser,
    svc: ProgramService = Depends(_program_svc),
) -> Response:
    await svc.delete_day(day_id)
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Program exercise endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/days/{day_id}/exercises",
    response_model=ProgramExerciseResponse,
    status_code=201,
)
async def add_exercise_to_day(
    day_id: uuid.UUID,
    data: ProgramExerciseCreate,
    current_user: CurrentUser,
    svc: ProgramService = Depends(_program_svc),
) -> ProgramExerciseResponse:
    return await svc.add_exercise(current_user, day_id, data)


@router.delete("/exercises-in-day/{ex_id}", status_code=204)
async def delete_program_exercise(
    ex_id: uuid.UUID,
    current_user: CurrentUser,
    svc: ProgramService = Depends(_program_svc),
) -> Response:
    await svc.delete_exercise(ex_id)
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Prescribed set endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/program-exercises/{ex_id}/sets",
    response_model=PrescribedSetResponse,
    status_code=201,
)
async def add_prescribed_set(
    ex_id: uuid.UUID,
    data: PrescribedSetCreate,
    current_user: CurrentUser,
    svc: ProgramService = Depends(_program_svc),
) -> PrescribedSetResponse:
    return await svc.add_prescribed_set(ex_id, data)


@router.put(
    "/program-exercises/{ex_id}/sets",
    response_model=list[PrescribedSetResponse],
)
async def replace_prescribed_sets(
    ex_id: uuid.UUID,
    data: list[PrescribedSetCreate],
    current_user: CurrentUser,
    svc: ProgramService = Depends(_program_svc),
) -> list[PrescribedSetResponse]:
    return await svc.replace_prescribed_sets(ex_id, data)


@router.delete("/program-exercises/{ex_id}/sets/{set_id}", status_code=204)
async def delete_prescribed_set(
    ex_id: uuid.UUID,
    set_id: uuid.UUID,
    current_user: CurrentUser,
    svc: ProgramService = Depends(_program_svc),
) -> Response:
    await svc.delete_prescribed_set(ex_id, set_id)
    return Response(status_code=204)
