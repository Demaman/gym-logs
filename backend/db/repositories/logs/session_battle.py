import secrets
import uuid
from datetime import UTC, datetime

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.logs.session_battle import SessionBattle

_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O, no 1/I


def _gen_code(length: int = 6) -> str:
    return "".join(secrets.choice(_CODE_CHARS) for _ in range(length))


class SessionBattleRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def create(self, initiator_session_id: uuid.UUID) -> SessionBattle:
        for _ in range(10):
            code = _gen_code()
            existing = await self.get_by_code(code)
            if not existing:
                break
        battle = SessionBattle(
            initiator_session_id=initiator_session_id,
            battle_code=code,
            status="waiting",
        )
        self._s.add(battle)
        await self._s.commit()
        await self._s.refresh(battle)
        return battle

    async def get_by_code(self, code: str) -> SessionBattle | None:
        result = await self._s.execute(
            select(SessionBattle).where(SessionBattle.battle_code == code.upper())
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, battle_id: uuid.UUID) -> SessionBattle | None:
        result = await self._s.execute(
            select(SessionBattle).where(SessionBattle.id == battle_id)
        )
        return result.scalar_one_or_none()

    async def get_by_session_id(self, session_id: uuid.UUID) -> SessionBattle | None:
        result = await self._s.execute(
            select(SessionBattle).where(
                or_(
                    SessionBattle.initiator_session_id == session_id,
                    SessionBattle.opponent_session_id == session_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_for_user(
        self, user_id: uuid.UUID, org_id: uuid.UUID | None, limit: int = 50
    ) -> list[SessionBattle]:
        from db.models.logs.workout_session import WorkoutSession as WS
        subq = select(WS.id).where(
            WS.athlete_id == user_id,
            *([WS.organization_id == org_id] if org_id else []),
        )
        result = await self._s.execute(
            select(SessionBattle)
            .where(
                or_(
                    SessionBattle.initiator_session_id.in_(subq),
                    SessionBattle.opponent_session_id.in_(subq),
                )
            )
            .order_by(SessionBattle.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def join(
        self, battle: SessionBattle, opponent_session_id: uuid.UUID
    ) -> SessionBattle:
        battle.opponent_session_id = opponent_session_id
        battle.status = "active"
        await self._s.commit()
        await self._s.refresh(battle)
        return battle

    async def finish(self, battle: SessionBattle) -> SessionBattle:
        battle.status = "finished"
        battle.finished_at = datetime.now(UTC)
        await self._s.commit()
        await self._s.refresh(battle)
        return battle

    async def cancel(self, battle: SessionBattle) -> None:
        await self._s.delete(battle)
        await self._s.commit()
