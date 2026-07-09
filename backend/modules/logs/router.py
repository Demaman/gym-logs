import uuid

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import CurrentUser
from core.database import get_db
from modules.logs.schemas import (
    FinishSessionRequest,
    LoggedExerciseCreate,
    LoggedExerciseResponse,
    LoggedSetCreate,
    LoggedSetResponse,
    LoggedSetUpdate,
    WorkoutSessionCreate,
    WorkoutSessionResponse,
)
from modules.logs.services import ExerciseLogService, SessionService, SetLogService

router = APIRouter(prefix="/logs", tags=["logs"])


def _session_svc(db: AsyncSession = Depends(get_db)) -> SessionService:
    return SessionService(db)


def _ex_svc(db: AsyncSession = Depends(get_db)) -> ExerciseLogService:
    return ExerciseLogService(db)


def _set_svc(db: AsyncSession = Depends(get_db)) -> SetLogService:
    return SetLogService(db)


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------


@router.post("/sessions", response_model=WorkoutSessionResponse, status_code=201)
async def start_session(
    data: WorkoutSessionCreate,
    current_user: CurrentUser,
    svc: SessionService = Depends(_session_svc),
) -> WorkoutSessionResponse:
    return await svc.start_session(current_user, data)


@router.get("/sessions", response_model=list[WorkoutSessionResponse])
async def list_sessions(
    current_user: CurrentUser,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    svc: SessionService = Depends(_session_svc),
) -> list[WorkoutSessionResponse]:
    return await svc.list_sessions(current_user, limit=limit, offset=offset)


# NOTE: /sessions/active must be defined BEFORE /sessions/{session_id}
# to avoid FastAPI routing the literal string "active" as a UUID path param.
@router.get("/sessions/active")
async def get_active_session(
    current_user: CurrentUser,
    response: Response,
    svc: SessionService = Depends(_session_svc),
):
    result = await svc.get_active(current_user)
    if result is None:
        response.status_code = 204
        return None
    return result


@router.get("/sessions/{session_id}", response_model=WorkoutSessionResponse)
async def get_session(
    session_id: uuid.UUID,
    current_user: CurrentUser,
    svc: SessionService = Depends(_session_svc),
) -> WorkoutSessionResponse:
    return await svc.get_session(current_user, session_id)


@router.patch(
    "/sessions/{session_id}/finish", response_model=WorkoutSessionResponse
)
async def finish_session(
    session_id: uuid.UUID,
    data: FinishSessionRequest,
    current_user: CurrentUser,
    svc: SessionService = Depends(_session_svc),
) -> WorkoutSessionResponse:
    return await svc.finish_session(current_user, session_id, data)


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: uuid.UUID,
    current_user: CurrentUser,
    svc: SessionService = Depends(_session_svc),
) -> None:
    await svc.delete_session(current_user, session_id)


# NOTE: /exercises/catalog/... must appear before /sessions/{id}/exercises/{id}
# response_model omitted — endpoint returns 204 (None) or PreviousExerciseSession
@router.get("/exercises/catalog/{catalog_exercise_id}/last-session")
async def get_exercise_last_session(
    catalog_exercise_id: uuid.UUID,
    current_user: CurrentUser,
    response: Response,
    svc: ExerciseLogService = Depends(_ex_svc),
):
    result = await svc.get_last_session(current_user, catalog_exercise_id)
    if result is None:
        response.status_code = 204
        return None
    return result


# ---------------------------------------------------------------------------
# Exercises within a session
# ---------------------------------------------------------------------------


@router.post(
    "/sessions/{session_id}/exercises",
    response_model=LoggedExerciseResponse,
    status_code=201,
)
async def add_exercise(
    session_id: uuid.UUID,
    data: LoggedExerciseCreate,
    current_user: CurrentUser,
    svc: ExerciseLogService = Depends(_ex_svc),
) -> LoggedExerciseResponse:
    return await svc.add_exercise(current_user, session_id, data)


@router.delete(
    "/sessions/{session_id}/exercises/{exercise_id}", status_code=204
)
async def delete_exercise(
    session_id: uuid.UUID,
    exercise_id: uuid.UUID,
    current_user: CurrentUser,
    svc: ExerciseLogService = Depends(_ex_svc),
) -> None:
    await svc.delete_exercise(current_user, session_id, exercise_id)


# ---------------------------------------------------------------------------
# Sets within an exercise
# ---------------------------------------------------------------------------


@router.post(
    "/sessions/{session_id}/exercises/{exercise_id}/sets",
    response_model=LoggedSetResponse,
    status_code=201,
)
async def add_set(
    session_id: uuid.UUID,
    exercise_id: uuid.UUID,
    data: LoggedSetCreate,
    current_user: CurrentUser,
    svc: SetLogService = Depends(_set_svc),
) -> LoggedSetResponse:
    return await svc.add_set(current_user, session_id, exercise_id, data)


@router.patch(
    "/sessions/{session_id}/exercises/{exercise_id}/sets/{set_id}",
    response_model=LoggedSetResponse,
)
async def update_set(
    session_id: uuid.UUID,
    exercise_id: uuid.UUID,
    set_id: uuid.UUID,
    data: LoggedSetUpdate,
    current_user: CurrentUser,
    svc: SetLogService = Depends(_set_svc),
) -> LoggedSetResponse:
    return await svc.update_set(current_user, session_id, set_id, data)


@router.delete(
    "/sessions/{session_id}/exercises/{exercise_id}/sets/{set_id}",
    status_code=204,
)
async def delete_set(
    session_id: uuid.UUID,
    exercise_id: uuid.UUID,
    set_id: uuid.UUID,
    current_user: CurrentUser,
    svc: SetLogService = Depends(_set_svc),
) -> None:
    await svc.delete_set(current_user, session_id, set_id)
