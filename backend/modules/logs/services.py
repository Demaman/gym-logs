import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.events import publish
from db.constants.training import COUNTS_VOLUME_DEFAULT
from db.repositories.logs import (
    LoggedExerciseRepository,
    LoggedSetRepository,
    WorkoutSessionRepository,
)
from db.repositories.training import (
    ExerciseRepository,
    ProgramDayRepository,
    ProgramRepository,
)
from modules.logs.schemas import (
    ExerciseAverage,
    ExerciseHistoryPoint,
    ExerciseHistorySeries,
    FinishSessionRequest,
    LoggedExerciseCreate,
    LoggedExerciseResponse,
    LoggedSetCreate,
    LoggedSetResponse,
    LoggedSetUpdate,
    PrescribedSetTarget,
    PreviousExerciseSession,
    ProgressStats,
    SessionSummary,
    WeeklyVolumePoint,
    WeeklyVolumeSeries,
    WorkoutSessionCreate,
    WorkoutSessionResponse,
)
from modules.logs.schemas.session import UpdateSessionRequest


class SessionService:
    def __init__(self, session: AsyncSession) -> None:
        self._session_repo = WorkoutSessionRepository(session)
        self._ex_repo = LoggedExerciseRepository(session)
        self._set_repo = LoggedSetRepository(session)
        self._program_day_repo = ProgramDayRepository(session)
        self._program_repo = ProgramRepository(session)
        self._exercise_repo = ExerciseRepository(session)

    def _ids(self, current_user: dict) -> tuple[uuid.UUID, uuid.UUID | None]:
        user_id = uuid.UUID(current_user["user_id"])
        org_id = (
            uuid.UUID(current_user["organization_id"])
            if current_user.get("organization_id")
            else None
        )
        return user_id, org_id

    async def _build_summary(
        self, session_id: uuid.UUID, program_day_id: uuid.UUID | None = None
    ) -> tuple[list, SessionSummary]:
        """Load exercises+sets and compute summary. Returns (exercises, summary)."""
        exercises = await self._ex_repo.list_for_session(session_id)
        total_volume = 0.0
        sets_by_type: dict[str, int] = {}
        working_sets = 0
        for ex in exercises:
            sets = await self._set_repo.list_for_exercise(ex.id)
            # Attach sets to exercise for response building (transient attribute)
            ex._loaded_sets = sets  # noqa: SLF001
            for s in sets:
                sets_by_type[s.set_type] = sets_by_type.get(s.set_type, 0) + 1
                if s.counts_volume:
                    total_volume += s.weight_kg * s.reps
                    working_sets += 1

        # Batch-fetch catalog exercises to attach demo_video_url (one query)
        exercise_ids = [ex.exercise_id for ex in exercises if ex.exercise_id]
        if exercise_ids:
            catalog_map = await self._exercise_repo.get_by_ids(exercise_ids)
            for ex in exercises:
                catalog_ex = catalog_map.get(ex.exercise_id) if ex.exercise_id else None
                ex._demo_video_url = catalog_ex.demo_video_url if catalog_ex else None  # noqa: SLF001
        else:
            for ex in exercises:
                ex._demo_video_url = None  # noqa: SLF001

        if program_day_id:
            await self._attach_prescribed_sets(exercises, program_day_id)
        summary = SessionSummary(
            duration_seconds=None,
            total_volume_kg=round(total_volume, 2),
            working_sets_count=working_sets,
            sets_by_type=sets_by_type,
            exercises_count=len(exercises),
        )
        return exercises, summary

    async def _attach_prescribed_sets(
        self, exercises: list, program_day_id: uuid.UUID
    ) -> None:
        """Attach prescribed set targets and program exercise video URL to exercises."""
        day = await self._program_day_repo.get_by_id(program_day_id)
        if not day:
            return
        pe_by_pos = {pe.position: pe for pe in day.exercises}
        for ex in exercises:
            pe = pe_by_pos.get(ex.position)
            if pe:
                if pe.prescribed_sets:
                    ex._prescribed_sets = [  # noqa: SLF001
                        PrescribedSetTarget(
                            set_type=ps.set_type,
                            rep_min=ps.rep_min,
                            rep_max=ps.rep_max,
                            rpe_target=ps.rpe_target,
                            rest_seconds=ps.rest_seconds,
                        )
                        for ps in sorted(pe.prescribed_sets, key=lambda s: s.position)
                    ]
                # Program exercise URL overrides catalog URL
                if pe.demo_video_url:
                    ex._demo_video_url = pe.demo_video_url  # noqa: SLF001

    @staticmethod
    def _ws_scalar(ws, *, exercises: list, summary: SessionSummary) -> WorkoutSessionResponse:
        """Construct WorkoutSessionResponse from scalar ORM fields only.

        Never passes the ORM object to model_validate — that would trigger
        lazy-loading of `logged_exercises` outside an async greenlet.
        """
        duration = (
            int((ws.finished_at - ws.started_at).total_seconds())
            if ws.finished_at
            else None
        )
        final_summary = SessionSummary(
            duration_seconds=duration,
            total_volume_kg=summary.total_volume_kg,
            working_sets_count=summary.working_sets_count,
            sets_by_type=summary.sets_by_type,
            exercises_count=summary.exercises_count,
        )
        ex_responses = [
            LoggedExerciseResponse(
                id=ex.id,
                session_id=ex.session_id,
                exercise_id=ex.exercise_id,
                exercise_name_free=ex.exercise_name_free,
                position=ex.position,
                notes=ex.notes,
                demo_video_url=getattr(ex, "_demo_video_url", None),
                logged_sets=[LoggedSetResponse.model_validate(s) for s in getattr(ex, "_loaded_sets", [])],
                prescribed_sets=getattr(ex, "_prescribed_sets", []),
            )
            for ex in exercises
        ]
        return WorkoutSessionResponse(
            id=ws.id,
            organization_id=ws.organization_id,
            athlete_id=ws.athlete_id,
            program_day_id=ws.program_day_id,
            name=ws.name,
            mode=ws.mode,
            day_tag=ws.day_tag,
            started_at=ws.started_at,
            finished_at=ws.finished_at,
            notes=ws.notes,
            perceived_difficulty=ws.perceived_difficulty,
            logged_exercises=ex_responses,
            summary=final_summary,
        )

    def _to_response(
        self, ws, exercises: list, summary: SessionSummary
    ) -> WorkoutSessionResponse:
        return self._ws_scalar(ws, exercises=exercises, summary=summary)

    async def start_session(
        self, current_user: dict, data: WorkoutSessionCreate
    ) -> WorkoutSessionResponse:
        user_id, org_id = self._ids(current_user)
        # Enforce one active session per athlete
        existing = await self._session_repo.get_active(
            organization_id=org_id, athlete_id=user_id
        )
        if existing:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "You already have an active session. Finish it before starting a new one.",
            )
        name = data.name or (
            f"{(data.day_tag or 'workout').replace('_', ' ').title()} "
            f"— {datetime.now(UTC).strftime('%b %d')}"
        )
        ws = await self._session_repo.create(
            organization_id=org_id,
            athlete_id=user_id,
            program_day_id=data.program_day_id,
            name=name,
            mode=data.mode,
            day_tag=data.day_tag,
        )

        # Pre-populate exercises from the program day
        pre_loaded: list = []
        if data.program_day_id:
            day = await self._program_day_repo.get_by_id(data.program_day_id)
            if day and day.exercises:
                for pe in sorted(day.exercises, key=lambda e: e.position):
                    exercise = await self._exercise_repo.get_by_id(pe.exercise_id)
                    logged = await self._ex_repo.create(
                        session_id=ws.id,
                        exercise_id=pe.exercise_id,
                        exercise_name_free=exercise.name if exercise else None,
                        position=pe.position,
                    )
                    logged._loaded_sets = []  # noqa: SLF001
                    logged._demo_video_url = pe.demo_video_url or (  # noqa: SLF001
                        exercise.demo_video_url if exercise else None
                    )
                    logged._prescribed_sets = [  # noqa: SLF001
                        PrescribedSetTarget(
                            set_type=ps.set_type,
                            rep_min=ps.rep_min,
                            rep_max=ps.rep_max,
                            rpe_target=ps.rpe_target,
                            rest_seconds=ps.rest_seconds,
                        )
                        for ps in sorted(pe.prescribed_sets, key=lambda s: s.position)
                    ]
                    pre_loaded.append(logged)

        summary = SessionSummary(
            duration_seconds=None, total_volume_kg=0.0,
            working_sets_count=0, sets_by_type={}, exercises_count=len(pre_loaded),
        )
        return self._ws_scalar(ws, exercises=pre_loaded, summary=summary)

    async def get_active(self, current_user: dict) -> WorkoutSessionResponse | None:
        user_id, org_id = self._ids(current_user)
        ws = await self._session_repo.get_active(
            organization_id=org_id, athlete_id=user_id
        )
        if not ws:
            return None
        exercises, summary = await self._build_summary(ws.id, ws.program_day_id)
        return self._to_response(ws, exercises, summary)

    async def get_session(
        self, current_user: dict, session_id: uuid.UUID
    ) -> WorkoutSessionResponse:
        user_id, org_id = self._ids(current_user)
        ws = await self._session_repo.get_by_id(
            session_id, organization_id=org_id, athlete_id=user_id
        )
        if not ws:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
        exercises, summary = await self._build_summary(ws.id, ws.program_day_id)
        return self._to_response(ws, exercises, summary)

    async def list_sessions(
        self, current_user: dict, *, limit: int = 20, offset: int = 0
    ) -> list[WorkoutSessionResponse]:
        user_id, org_id = self._ids(current_user)
        sessions = await self._session_repo.list_for_athlete(
            organization_id=org_id, athlete_id=user_id, limit=limit, offset=offset
        )
        results = []
        for ws in sessions:
            exercises, summary = await self._build_summary(ws.id)
            results.append(self._to_response(ws, exercises, summary))
        return results

    async def finish_session(
        self, current_user: dict, session_id: uuid.UUID, data: FinishSessionRequest
    ) -> WorkoutSessionResponse:
        user_id, org_id = self._ids(current_user)
        ws = await self._session_repo.get_by_id(
            session_id, organization_id=org_id, athlete_id=user_id
        )
        if not ws:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
        if ws.finished_at is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Session already finished")
        exercises, summary = await self._build_summary(ws.id)
        ws = await self._session_repo.finish(
            ws, notes=data.notes, perceived_difficulty=data.perceived_difficulty
        )
        duration = int((ws.finished_at - ws.started_at).total_seconds())
        await publish(
            "workout_session.finished",
            {
                "session_id": str(ws.id),
                "athlete_id": str(ws.athlete_id),
                "organization_id": str(ws.organization_id) if ws.organization_id else None,
                "program_day_id": str(ws.program_day_id) if ws.program_day_id else None,
                "total_volume_kg": summary.total_volume_kg,
                "sets_by_type": summary.sets_by_type,
                "duration_seconds": duration,
                "finished_at": ws.finished_at.isoformat(),
            },
        )
        return self._to_response(ws, exercises, summary)

    async def update_session(
        self, current_user: dict, session_id: uuid.UUID, data: UpdateSessionRequest
    ) -> WorkoutSessionResponse:
        user_id, org_id = self._ids(current_user)
        ws = await self._session_repo.get_by_id(
            session_id, athlete_id=user_id, organization_id=org_id
        )
        if ws is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
        if ws.finished_at is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Cannot update a finished session"
            )
        if data.name is not None:
            ws.name = data.name
        if data.day_tag is not None:
            ws.day_tag = data.day_tag
        if "program_day_id" in data.model_fields_set:
            if data.program_day_id is not None:
                if org_id is None:
                    raise HTTPException(
                        status.HTTP_403_FORBIDDEN,
                        "Linking to a program day requires an organization context",
                    )
                day = await self._program_day_repo.get_by_id(data.program_day_id)
                if not day:
                    raise HTTPException(
                        status.HTTP_404_NOT_FOUND, "Program day not found"
                    )
                program = await self._program_repo.get_by_id(
                    day.program_id, organization_id=org_id
                )
                if not program:
                    raise HTTPException(
                        status.HTTP_403_FORBIDDEN,
                        "Program day does not belong to your organization",
                    )
                ws.program_day_id = data.program_day_id
                # Auto-sync day_tag unless caller explicitly provided one
                if "day_tag" not in data.model_fields_set and day.day_tag:
                    ws.day_tag = day.day_tag
            else:
                ws.program_day_id = None
        await self._session_repo.save(ws)
        exercises = await self._ex_repo.list_for_session(ws.id)
        empty_summary = SessionSummary(
            duration_seconds=None, total_volume_kg=0.0,
            working_sets_count=0, sets_by_type={}, exercises_count=0,
        )
        return self._ws_scalar(ws, exercises=exercises, summary=empty_summary)

    async def delete_session(
        self, current_user: dict, session_id: uuid.UUID
    ) -> None:
        user_id, org_id = self._ids(current_user)
        ws = await self._session_repo.get_by_id(
            session_id, organization_id=org_id, athlete_id=user_id
        )
        if not ws:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
        await self._session_repo.delete(ws)

    async def get_progress_stats(self, current_user: dict) -> ProgressStats:
        user_id, org_id = self._ids(current_user)
        raw = await self._session_repo.get_progress_stats(
            organization_id=org_id, athlete_id=user_id
        )
        return ProgressStats(**raw)

    async def get_weekly_volume(
        self, current_user: dict, *, weeks: int = 12
    ) -> WeeklyVolumeSeries:
        user_id, org_id = self._ids(current_user)
        raw = await self._session_repo.get_weekly_volume(
            organization_id=org_id, athlete_id=user_id, weeks=weeks
        )
        return WeeklyVolumeSeries(points=[WeeklyVolumePoint(**r) for r in raw])

    async def get_exercise_history(
        self, current_user: dict, catalog_exercise_id: uuid.UUID
    ) -> ExerciseHistorySeries:
        user_id, org_id = self._ids(current_user)
        raw = await self._session_repo.get_exercise_history(
            organization_id=org_id,
            athlete_id=user_id,
            catalog_exercise_id=catalog_exercise_id,
        )
        exercise = await self._exercise_repo.get_by_id(catalog_exercise_id)
        return ExerciseHistorySeries(
            exercise_name=exercise.name if exercise else None,
            points=[ExerciseHistoryPoint(**r) for r in raw],
        )


class ExerciseLogService:
    def __init__(self, session: AsyncSession) -> None:
        self._session_repo = WorkoutSessionRepository(session)
        self._ex_repo = LoggedExerciseRepository(session)
        self._set_repo = LoggedSetRepository(session)

    def _ids(self, current_user: dict) -> tuple[uuid.UUID, uuid.UUID | None]:
        return uuid.UUID(current_user["user_id"]), (
            uuid.UUID(current_user["organization_id"])
            if current_user.get("organization_id")
            else None
        )

    async def _get_session_or_404(self, session_id: uuid.UUID, current_user: dict):
        user_id, org_id = self._ids(current_user)
        ws = await self._session_repo.get_by_id(
            session_id, organization_id=org_id, athlete_id=user_id
        )
        if not ws:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
        return ws

    async def add_exercise(
        self,
        current_user: dict,
        session_id: uuid.UUID,
        data: LoggedExerciseCreate,
    ) -> LoggedExerciseResponse:
        ws = await self._get_session_or_404(session_id, current_user)
        if ws.finished_at:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Cannot modify a finished session"
            )
        existing = await self._ex_repo.list_for_session(session_id)
        position = len(existing) + 1
        ex = await self._ex_repo.create(
            session_id=session_id,
            exercise_id=data.exercise_id,
            exercise_name_free=data.exercise_name_free,
            position=position,
            notes=data.notes,
        )
        return LoggedExerciseResponse(
            id=ex.id,
            session_id=ex.session_id,
            exercise_id=ex.exercise_id,
            exercise_name_free=ex.exercise_name_free,
            position=ex.position,
            notes=ex.notes,
            logged_sets=[],
        )

    async def delete_exercise(
        self,
        current_user: dict,
        session_id: uuid.UUID,
        exercise_id: uuid.UUID,
    ) -> None:
        ws = await self._get_session_or_404(session_id, current_user)
        if ws.finished_at:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Cannot modify a finished session"
            )
        exercises = await self._ex_repo.list_for_session(session_id)
        ex = next((e for e in exercises if e.id == exercise_id), None)
        if not ex:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, "Exercise not found in session"
            )
        await self._ex_repo.delete(ex)

    async def get_last_session(
        self, current_user: dict, catalog_exercise_id: uuid.UUID
    ) -> PreviousExerciseSession | None:
        user_id, _ = self._ids(current_user)
        result = await self._ex_repo.get_last_for_catalog_exercise(
            athlete_id=user_id,
            catalog_exercise_id=catalog_exercise_id,
        )
        if result is None:
            return None
        logged_ex, session_name, started_at = result
        sets = await self._set_repo.list_for_exercise(logged_ex.id)
        if not sets:
            return None
        volume_sets = [s for s in sets if s.counts_volume]
        rpe_sets = [s for s in sets if s.rpe is not None]
        avg_weight = (
            round(sum(s.weight_kg for s in volume_sets) / len(volume_sets), 1)
            if volume_sets
            else None
        )
        avg_reps = (
            round(sum(s.reps for s in volume_sets) / len(volume_sets), 1)
            if volume_sets
            else None
        )
        avg_rpe = (
            round(sum(s.rpe for s in rpe_sets) / len(rpe_sets), 1)
            if rpe_sets
            else None
        )
        total_vol = round(sum(s.weight_kg * s.reps for s in volume_sets), 1)
        return PreviousExerciseSession(
            session_name=session_name,
            session_date=started_at.date().isoformat(),
            sets=[LoggedSetResponse.model_validate(s) for s in sets],
            average=ExerciseAverage(
                weight_kg=avg_weight,
                reps=avg_reps,
                rpe=avg_rpe,
                total_volume_kg=total_vol,
                sets_count=len(sets),
                volume_sets_count=len(volume_sets),
            ),
        )


class SetLogService:
    def __init__(self, session: AsyncSession) -> None:
        self._session_repo = WorkoutSessionRepository(session)
        self._ex_repo = LoggedExerciseRepository(session)
        self._set_repo = LoggedSetRepository(session)

    def _ids(self, current_user: dict) -> tuple[uuid.UUID, uuid.UUID | None]:
        return uuid.UUID(current_user["user_id"]), (
            uuid.UUID(current_user["organization_id"])
            if current_user.get("organization_id")
            else None
        )

    async def _get_active_session_or_404(
        self, session_id: uuid.UUID, current_user: dict
    ):
        user_id, org_id = self._ids(current_user)
        ws = await self._session_repo.get_by_id(
            session_id, organization_id=org_id, athlete_id=user_id
        )
        if not ws:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
        if ws.finished_at:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Cannot modify a finished session"
            )
        return ws

    async def add_set(
        self,
        current_user: dict,
        session_id: uuid.UUID,
        exercise_id: uuid.UUID,
        data: LoggedSetCreate,
    ) -> LoggedSetResponse:
        await self._get_active_session_or_404(session_id, current_user)
        exercises = await self._ex_repo.list_for_session(session_id)
        ex = next((e for e in exercises if e.id == exercise_id), None)
        if not ex:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, "Exercise not found in session"
            )
        existing_sets = await self._set_repo.list_for_exercise(exercise_id)
        position = len(existing_sets) + 1
        # Auto-fill counts_volume if not provided
        counts_volume = (
            data.counts_volume
            if data.counts_volume is not None
            else COUNTS_VOLUME_DEFAULT.get(data.set_type, True)
        )
        logged = await self._set_repo.create(
            logged_exercise_id=exercise_id,
            position=position,
            set_type=data.set_type,
            weight_kg=data.weight_kg,
            reps=data.reps,
            rpe=data.rpe,
            rir=data.rir,
            is_to_failure=data.is_to_failure,
            counts_volume=counts_volume,
            tempo=data.tempo,

            
            notes=data.notes,
        )
        return LoggedSetResponse.model_validate(logged)

    async def update_set(
        self,
        current_user: dict,
        session_id: uuid.UUID,
        set_id: uuid.UUID,
        data: LoggedSetUpdate,
    ) -> LoggedSetResponse:
        await self._get_active_session_or_404(session_id, current_user)
        logged = await self._set_repo.get_by_id(set_id)
        if not logged:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Set not found")
        updates = data.model_dump(exclude_none=True)
        # If set_type changed and counts_volume not explicitly set, recalculate
        if "set_type" in updates and "counts_volume" not in updates:
            updates["counts_volume"] = COUNTS_VOLUME_DEFAULT.get(
                updates["set_type"], True
            )
        logged = await self._set_repo.update(logged, **updates)
        return LoggedSetResponse.model_validate(logged)

    async def delete_set(
        self,
        current_user: dict,
        session_id: uuid.UUID,
        set_id: uuid.UUID,
    ) -> None:
        await self._get_active_session_or_404(session_id, current_user)
        logged = await self._set_repo.get_by_id(set_id)
        if not logged:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Set not found")
        await self._set_repo.delete(logged)
