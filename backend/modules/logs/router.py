import uuid

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import CurrentUser
from core.database import get_db
from modules.logs.schemas import (
    AttendanceCheckinRequest,
    AttendanceSummary,
    BattleResponse,
    BattleStateResponse,
    ExerciseHistorySeries,
    FinishSessionRequest,
    JoinBattleResponse,
    LoggedExerciseCreate,
    LoggedExerciseResponse,
    LoggedSetCreate,
    LoggedSetResponse,
    LoggedSetUpdate,
    ProgressStats,
    WeeklyVolumeSeries,
    WorkoutSessionCreate,
    WorkoutSessionResponse,
)
from modules.logs.schemas.session import UpdateSessionRequest
from modules.logs.services import AttendanceService, BattleService, ExerciseLogService, SessionService, SetLogService, TrainerLogService

router = APIRouter(prefix="/logs", tags=["logs"])


def _session_svc(db: AsyncSession = Depends(get_db)) -> SessionService:
    return SessionService(db)


def _trainer_svc(db: AsyncSession = Depends(get_db)) -> TrainerLogService:
    return TrainerLogService(db)


def _ex_svc(db: AsyncSession = Depends(get_db)) -> ExerciseLogService:
    return ExerciseLogService(db)


def _set_svc(db: AsyncSession = Depends(get_db)) -> SetLogService:
    return SetLogService(db)


def _attendance_svc(db: AsyncSession = Depends(get_db)) -> AttendanceService:
    return AttendanceService(db)


def _battle_svc(db: AsyncSession = Depends(get_db)) -> BattleService:
    return BattleService(db)


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


# NOTE: /sessions/stats and /sessions/volume-over-time must be defined BEFORE
# /sessions/{session_id} to avoid the literal strings being parsed as UUIDs.
@router.get("/sessions/stats", response_model=ProgressStats)
async def get_progress_stats(
    current_user: CurrentUser,
    svc: SessionService = Depends(_session_svc),
) -> ProgressStats:
    return await svc.get_progress_stats(current_user)


@router.get("/sessions/volume-over-time", response_model=WeeklyVolumeSeries)
async def get_volume_over_time(
    current_user: CurrentUser,
    weeks: int = Query(default=12, ge=4, le=52),
    svc: SessionService = Depends(_session_svc),
) -> WeeklyVolumeSeries:
    return await svc.get_weekly_volume(current_user, weeks=weeks)


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


@router.patch("/sessions/{session_id}", response_model=WorkoutSessionResponse)
async def update_session(
    session_id: uuid.UUID,
    body: UpdateSessionRequest,
    current_user: CurrentUser,
    svc: SessionService = Depends(_session_svc),
) -> WorkoutSessionResponse:
    return await svc.update_session(current_user, session_id, body)


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


@router.get(
    "/exercises/catalog/{catalog_exercise_id}/history",
    response_model=ExerciseHistorySeries,
)
async def get_exercise_history(
    catalog_exercise_id: uuid.UUID,
    current_user: CurrentUser,
    svc: SessionService = Depends(_session_svc),
) -> ExerciseHistorySeries:
    return await svc.get_exercise_history(current_user, catalog_exercise_id)


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


# ---------------------------------------------------------------------------
# Trainer-scoped athlete log endpoints
# ---------------------------------------------------------------------------


@router.post("/athletes/{athlete_id}/sessions", response_model=WorkoutSessionResponse, status_code=201)
async def trainer_start_session(
    athlete_id: uuid.UUID,
    data: WorkoutSessionCreate,
    current_user: CurrentUser,
    svc: TrainerLogService = Depends(_trainer_svc),
) -> WorkoutSessionResponse:
    return await svc.start_athlete_session(current_user, athlete_id, data)


# NOTE: /athletes/{athlete_id}/sessions/active must come before list so FastAPI
# doesn't try to parse the literal "active" as a UUID.
@router.get("/athletes/{athlete_id}/sessions/active")
async def trainer_get_athlete_active_session(
    athlete_id: uuid.UUID,
    current_user: CurrentUser,
    response: Response,
    svc: TrainerLogService = Depends(_trainer_svc),
):
    result = await svc.get_athlete_active_session(current_user, athlete_id)
    if result is None:
        response.status_code = 204
        return None
    return result


@router.patch(
    "/athletes/{athlete_id}/sessions/{session_id}/finish",
    response_model=WorkoutSessionResponse,
)
async def trainer_finish_session(
    athlete_id: uuid.UUID,
    session_id: uuid.UUID,
    data: FinishSessionRequest,
    current_user: CurrentUser,
    svc: TrainerLogService = Depends(_trainer_svc),
) -> WorkoutSessionResponse:
    return await svc.finish_athlete_session(current_user, athlete_id, session_id, data)


@router.get("/athletes/{athlete_id}/sessions", response_model=list[WorkoutSessionResponse])
async def list_athlete_sessions(
    athlete_id: uuid.UUID,
    current_user: CurrentUser,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    svc: TrainerLogService = Depends(_trainer_svc),
) -> list[WorkoutSessionResponse]:
    return await svc.list_athlete_sessions(current_user, athlete_id, limit=limit, offset=offset)


@router.get("/athletes/{athlete_id}/sessions/stats", response_model=ProgressStats)
async def get_athlete_stats(
    athlete_id: uuid.UUID,
    current_user: CurrentUser,
    svc: TrainerLogService = Depends(_trainer_svc),
) -> ProgressStats:
    return await svc.get_athlete_stats(current_user, athlete_id)


@router.get("/athletes/{athlete_id}/sessions/volume-over-time", response_model=WeeklyVolumeSeries)
async def get_athlete_weekly_volume(
    athlete_id: uuid.UUID,
    current_user: CurrentUser,
    weeks: int = Query(26, ge=4, le=52),
    svc: TrainerLogService = Depends(_trainer_svc),
) -> WeeklyVolumeSeries:
    return await svc.get_athlete_weekly_volume(current_user, athlete_id, weeks=weeks)


@router.get(
    "/athletes/{athlete_id}/exercises/{catalog_id}/history",
    response_model=ExerciseHistorySeries,
)
async def get_athlete_exercise_history(
    athlete_id: uuid.UUID,
    catalog_id: uuid.UUID,
    current_user: CurrentUser,
    svc: TrainerLogService = Depends(_trainer_svc),
) -> ExerciseHistorySeries:
    return await svc.get_athlete_exercise_history(current_user, athlete_id, catalog_id)


# ── Attendance ─────────────────────────────────────────────────────────────────


@router.post("/attendance/checkin", status_code=204)
async def manual_checkin(
    data: AttendanceCheckinRequest,
    current_user: CurrentUser,
    svc: AttendanceService = Depends(_attendance_svc),
) -> None:
    await svc.manual_checkin(current_user, data)


@router.get("/attendance/summary", response_model=AttendanceSummary)
async def get_attendance_summary(
    current_user: CurrentUser,
    svc: AttendanceService = Depends(_attendance_svc),
) -> AttendanceSummary:
    return await svc.get_summary(current_user)


# ── Battles ─────────────────────────────────────────────────────────────────


# NOTE: /sessions/{session_id}/battle must come after /sessions/{session_id}
# to avoid conflicts — FastAPI handles by declaration order.

@router.post("/sessions/{session_id}/battle", response_model=BattleResponse, status_code=201)
async def start_battle(
    session_id: uuid.UUID,
    current_user: CurrentUser,
    svc: BattleService = Depends(_battle_svc),
) -> BattleResponse:
    return await svc.start_battle(current_user, session_id)


# NOTE: /sessions/{session_id}/battle must be declared BEFORE the generic
# /sessions/{session_id} GET so "battle" isn't routed as a second path segment.
@router.get("/sessions/{session_id}/battle")
async def get_session_battle(
    session_id: uuid.UUID,
    current_user: CurrentUser,
    response: Response,
    svc: BattleService = Depends(_battle_svc),
):
    result = await svc.get_session_battle(current_user, session_id)
    if result is None:
        response.status_code = 204
        return None
    return result


@router.post("/battles/{code}/join", response_model=JoinBattleResponse, status_code=201)
async def join_battle(
    code: str,
    data: WorkoutSessionCreate,
    current_user: CurrentUser,
    svc: BattleService = Depends(_battle_svc),
) -> JoinBattleResponse:
    return await svc.join_battle(current_user, code, data)


@router.get("/battles", response_model=list[BattleStateResponse])
async def list_battles(
    current_user: CurrentUser,
    svc: BattleService = Depends(_battle_svc),
) -> list[BattleStateResponse]:
    return await svc.list_battles(current_user)


@router.get("/battles/{battle_id}", response_model=BattleStateResponse)
async def get_battle_state(
    battle_id: uuid.UUID,
    current_user: CurrentUser,
    svc: BattleService = Depends(_battle_svc),
) -> BattleStateResponse:
    return await svc.get_battle_state(current_user, battle_id)
