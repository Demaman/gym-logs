import uuid
from pathlib import Path

import aiofiles
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
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
    ProgramExerciseUpdate,
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
            demo_video_url=data.demo_video_url,
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
        updates = data.model_dump(exclude_unset=True)
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

    _ALLOWED_VIDEO_MIMES = {
        "video/mp4", "video/webm", "video/ogg", "video/quicktime"
    }
    _MIME_TO_EXT = {
        "video/mp4": ".mp4",
        "video/webm": ".webm",
        "video/ogg": ".ogv",
        "video/quicktime": ".mov",
    }
    _MAX_VIDEO_BYTES = 200 * 1024 * 1024  # 200 MB

    async def upload_video(
        self, current_user: dict, exercise_id: uuid.UUID, file: UploadFile
    ) -> ExerciseResponse:
        ex = await self._repo.get_by_id(exercise_id)
        if not ex:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")
        if str(ex.created_by_id) != current_user["user_id"] and current_user[
            "role"
        ] != "gym_admin":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")

        content_type = (file.content_type or "").split(";")[0].strip().lower()
        if content_type not in self._ALLOWED_VIDEO_MIMES:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "Only video files are accepted (mp4, webm, ogg, mov)",
            )

        ext = self._MIME_TO_EXT[content_type]
        dest = Path(settings.media_root) / "exercises" / f"{exercise_id}{ext}"
        dest.parent.mkdir(parents=True, exist_ok=True)

        # Stream file while enforcing size cap
        total = 0
        async with aiofiles.open(dest, "wb") as out:
            while chunk := await file.read(1024 * 256):  # 256 KB chunks
                total += len(chunk)
                if total > self._MAX_VIDEO_BYTES:
                    dest.unlink(missing_ok=True)
                    raise HTTPException(
                        status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        "Video must be under 200 MB",
                    )
                await out.write(chunk)

        # Remove old local file if it was a different extension
        for old_ext in self._MIME_TO_EXT.values():
            if old_ext != ext:
                old_path = dest.parent / f"{exercise_id}{old_ext}"
                old_path.unlink(missing_ok=True)

        base = (settings.media_base_url or "").rstrip("/")
        url = f"{base}/media/exercises/{exercise_id}{ext}"
        ex = await self._repo.update(ex, demo_video_url=url)
        return ExerciseResponse.model_validate(ex)


class ProgramService:
    def __init__(self, session: AsyncSession) -> None:
        self._program_repo = ProgramRepository(session)
        self._day_repo = ProgramDayRepository(session)
        self._ex_repo = ProgramExerciseRepository(session)
        self._set_repo = PrescribedSetRepository(session)

    def _org_id(self, current_user: dict) -> uuid.UUID | None:
        org_id = current_user.get("organization_id")
        return uuid.UUID(org_id) if org_id else None

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
            guidelines=data.guidelines,
            mode=data.mode,
            created_by_id=self._user_id(current_user),
        )
        await publish(
            "program.created",
            {
                "program_id": str(program.id),
                "athlete_id": str(program.athlete_id),
                "organization_id": str(program.organization_id) if program.organization_id else None,
            },
        )
        return ProgramResponse.model_validate(program)

    async def get(
        self, current_user: dict, program_id: uuid.UUID
    ) -> ProgramResponse:
        org_id = self._org_id(current_user)
        user_id = self._user_id(current_user)
        p = await self._program_repo.get_by_id(program_id, organization_id=org_id, user_id=user_id)
        if not p:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Program not found")
        return ProgramResponse.model_validate(p)

    async def list_for_user(self, current_user: dict) -> list[ProgramResponse]:
        org_id = self._org_id(current_user)
        user_id = self._user_id(current_user)
        if current_user["role"] == "gym_admin":
            if org_id is None:
                return []
            programs = await self._program_repo.list_for_org(org_id)
        elif current_user["role"] == "trainer":
            programs = await self._program_repo.list_for_trainer(user_id, org_id)
        else:
            programs = await self._program_repo.list_for_athlete(user_id, org_id)
        return [ProgramResponse.model_validate(p) for p in programs]

    async def update(
        self, current_user: dict, program_id: uuid.UUID, data: ProgramUpdate
    ) -> ProgramResponse:
        org_id = self._org_id(current_user)
        user_id = self._user_id(current_user)
        p = await self._program_repo.get_by_id(program_id, organization_id=org_id, user_id=user_id)
        if not p:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Program not found")
        if (
            str(p.created_by_id) != current_user["user_id"]
            and current_user["role"] != "gym_admin"
        ):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")
        if data.athlete_id and data.athlete_id != user_id:
            if current_user["role"] not in ("trainer", "gym_admin"):
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    "Only trainers can assign programs to athletes",
                )
        p = await self._program_repo.update(p, **data.model_dump(exclude_none=True))
        return ProgramResponse.model_validate(p)

    async def delete(self, current_user: dict, program_id: uuid.UUID) -> None:
        org_id = self._org_id(current_user)
        user_id = self._user_id(current_user)
        p = await self._program_repo.get_by_id(program_id, organization_id=org_id, user_id=user_id)
        if not p:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Program not found")
        if (
            str(p.created_by_id) != current_user["user_id"]
            and current_user["role"] != "gym_admin"
        ):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")
        await self._program_repo.soft_delete(p)

    async def bulk_assign(
        self, current_user: dict, program_id: uuid.UUID, athlete_ids: list[uuid.UUID]
    ) -> list[ProgramResponse]:
        org_id = self._org_id(current_user)
        user_id = self._user_id(current_user)
        if current_user["role"] not in ("trainer", "gym_admin"):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Only trainers can assign programs to athletes",
            )
        source = await self._program_repo.get_by_id(
            program_id, organization_id=org_id, user_id=user_id
        )
        if not source:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Program not found")
        if (
            str(source.created_by_id) != current_user["user_id"]
            and current_user["role"] != "gym_admin"
        ):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")

        created: list[ProgramResponse] = []
        for athlete_id in athlete_ids:
            if athlete_id == user_id:
                continue
            copy = await self._program_repo.create(
                organization_id=org_id,
                athlete_id=athlete_id,
                name=source.name,
                description=source.description,
                mode=source.mode,
                created_by_id=user_id,
            )
            await self._attach_days_from_model(copy.id, source.days)
            full_copy = await self._program_repo.get_by_id_fresh(copy.id)
            if full_copy:
                await publish(
                    "program.created",
                    {
                        "program_id": str(full_copy.id),
                        "athlete_id": str(full_copy.athlete_id),
                        "organization_id": str(full_copy.organization_id)
                        if full_copy.organization_id
                        else None,
                    },
                )
                created.append(ProgramResponse.model_validate(full_copy))
        return created

    async def _attach_days_from_model(self, program_id: uuid.UUID, days) -> None:
        for day in sorted(days, key=lambda d: d.position):
            new_day = await self._day_repo.create(
                program_id=program_id,
                name=day.name,
                position=day.position,
                day_tag=day.day_tag,
            )
            for ex in sorted(day.exercises, key=lambda e: e.position):
                new_ex = await self._ex_repo.create(
                    program_day_id=new_day.id,
                    exercise_id=ex.exercise_id,
                    position=ex.position,
                    notes=ex.notes,
                    demo_video_url=ex.demo_video_url,
                )
                for ps in sorted(ex.prescribed_sets, key=lambda s: s.position):
                    await self._set_repo.create(
                        program_exercise_id=new_ex.id,
                        position=ps.position,
                        set_type=ps.set_type,
                        rep_min=ps.rep_min,
                        rep_max=ps.rep_max,
                        rpe_target=ps.rpe_target,
                        rest_seconds=ps.rest_seconds,
                        weight_pct_1rm=ps.weight_pct_1rm,
                        notes=ps.notes,
                    )

    async def _attach_days_from_dict(
        self, program_id: uuid.UUID, days: list[dict]
    ) -> None:
        for i, day in enumerate(days, start=1):
            new_day = await self._day_repo.create(
                program_id=program_id,
                name=day["name"],
                position=day.get("position", i),
                day_tag=("custom" if day.get("day_tag") in (None, "", "rest") else day.get("day_tag")),
            )
            for j, ex in enumerate(day.get("exercises", []), start=1):
                new_ex = await self._ex_repo.create(
                    program_day_id=new_day.id,
                    exercise_id=uuid.UUID(ex["exercise_id"]),
                    position=ex.get("position", j),
                    notes=ex.get("notes"),
                )
                for k, ps in enumerate(ex.get("prescribed_sets", []), start=1):
                    await self._set_repo.create(
                        program_exercise_id=new_ex.id,
                        position=ps.get("position", k),
                        set_type=ps["set_type"],
                        rep_min=ps["rep_min"],
                        rep_max=ps["rep_max"],
                        rpe_target=ps.get("rpe_target"),
                        rest_seconds=ps.get("rest_seconds"),
                        weight_pct_1rm=ps.get("weight_pct_1rm"),
                        notes=ps.get("notes"),
                    )

    async def create_full(
        self,
        current_user: dict,
        athlete_id: uuid.UUID,
        data: dict,
    ) -> ProgramResponse:
        org_id = self._org_id(current_user)
        user_id = self._user_id(current_user)
        program = await self._program_repo.create(
            organization_id=org_id,
            athlete_id=athlete_id,
            name=data["name"],
            description=data.get("description"),
            guidelines=data.get("guidelines"),
            mode=data.get("mode", "program_driven"),
            created_by_id=user_id,
        )
        await self._attach_days_from_dict(program.id, data.get("days", []))
        full = await self._program_repo.get_by_id_fresh(program.id)
        await publish(
            "program.created",
            {
                "program_id": str(full.id),
                "athlete_id": str(full.athlete_id),
                "organization_id": str(full.organization_id)
                if full.organization_id
                else None,
            },
        )
        return ProgramResponse.model_validate(full)

    async def add_day(
        self, current_user: dict, program_id: uuid.UUID, data: ProgramDayCreate
    ) -> ProgramDayResponse:
        org_id = self._org_id(current_user)
        user_id = self._user_id(current_user)
        p = await self._program_repo.get_by_id(program_id, organization_id=org_id, user_id=user_id)
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
            demo_video_url=data.demo_video_url,
        )
        return ProgramExerciseResponse.model_validate(ex)

    async def update_program_exercise(
        self, current_user: dict, ex_id: uuid.UUID, data: ProgramExerciseUpdate
    ) -> ProgramExerciseResponse:
        ex = await self._ex_repo.get_by_id(ex_id)
        if not ex:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Program exercise not found")
        updates = data.model_dump(exclude_unset=True)
        ex = await self._ex_repo.update(ex, **updates)
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

    async def replace_prescribed_sets(
        self, ex_id: uuid.UUID, data: list[PrescribedSetCreate]
    ) -> list[PrescribedSetResponse]:
        ex = await self._ex_repo.get_by_id(ex_id)
        if not ex:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Program exercise not found")
        new_sets = [d.model_dump(exclude={"position"}) for d in data]
        replaced = await self._set_repo.bulk_replace(ex_id, new_sets)
        return [PrescribedSetResponse.model_validate(ps) for ps in replaced]

    async def delete_prescribed_set(
        self, ex_id: uuid.UUID, set_id: uuid.UUID
    ) -> None:
        ps = await self._set_repo.get_by_id(set_id)
        if not ps:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, "Prescribed set not found"
            )
        if ps.program_exercise_id != ex_id:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, "Prescribed set not found"
            )
        await self._set_repo.delete(ps)
