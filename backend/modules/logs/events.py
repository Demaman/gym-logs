import uuid
from datetime import UTC, datetime

from core.database import AsyncSessionLocal
from db.repositories.logs import AttendanceRepository, SessionBattleRepository
from db.repositories.logs.workout_session import WorkoutSessionRepository

# workout_session.finished payload contract (published by SessionService.finish_session):
# {
#   session_id: str,
#   athlete_id: str,
#   organization_id: str | None,
#   program_day_id: str | None,
#   total_volume_kg: float,
#   sets_by_type: dict[str, int],
#   duration_seconds: int,
#   finished_at: str,  # ISO 8601
# }


async def on_session_finished_record_attendance(payload: dict) -> None:
    """Auto-record attendance when a workout session is finished."""
    athlete_id_str = payload.get("athlete_id")
    org_id_str = payload.get("organization_id")
    finished_at_str = payload.get("finished_at")

    if not athlete_id_str:
        return

    athlete_id = uuid.UUID(athlete_id_str)
    org_id = uuid.UUID(org_id_str) if org_id_str else None
    checked_in_at = (
        datetime.fromisoformat(finished_at_str)
        if finished_at_str
        else datetime.now(UTC)
    )
    today = checked_in_at.date()

    async with AsyncSessionLocal() as session:
        repo = AttendanceRepository(session)
        already = await repo.already_checked_in_today(
            organization_id=org_id,
            user_id=athlete_id,
            today=today,
            source="session_log",
        )
        if not already:
            await repo.create(
                organization_id=org_id,
                user_id=athlete_id,
                checked_in_at=checked_in_at,
                source="session_log",
            )


async def on_session_finished_resolve_battle(payload: dict) -> None:
    """Auto-finish a battle when both participants have finished their sessions."""
    session_id_str = payload.get("session_id")
    if not session_id_str:
        return

    session_id = uuid.UUID(session_id_str)

    async with AsyncSessionLocal() as session:
        battle_repo = SessionBattleRepository(session)
        ws_repo = WorkoutSessionRepository(session)

        battle = await battle_repo.get_by_session_id(session_id)
        if not battle or battle.status != "active" or not battle.opponent_session_id:
            return

        opp = await ws_repo.get_by_id_any(battle.opponent_session_id)
        init = await ws_repo.get_by_id_any(battle.initiator_session_id)

        if init and opp and init.finished_at is not None and opp.finished_at is not None:
            await battle_repo.finish(battle)
