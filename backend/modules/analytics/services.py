import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import CurrentUser
from db.repositories.analytics import (
    AthleteProfileRepository,
    BodyMeasurementRepository,
)
from modules.analytics.schemas import (
    AthleteProfileResponse,
    AthleteProfileUpdate,
    BodyMeasurementCreate,
    BodyMeasurementResponse,
    BodyMeasurementUpdate,
)


class AnamnesisService:
    def __init__(self, session: AsyncSession) -> None:
        self._profile_repo = AthleteProfileRepository(session)
        self._measurement_repo = BodyMeasurementRepository(session)

    def _user_id(self, user: CurrentUser) -> uuid.UUID:
        return uuid.UUID(str(user["user_id"]))

    def _org_id(self, user: CurrentUser) -> uuid.UUID | None:
        oid = user.get("organization_id")
        return uuid.UUID(str(oid)) if oid else None

    # ── Authorization helper ──────────────────────────────────────────────────

    async def _ensure_trainer_access(self, user: CurrentUser, athlete_id: uuid.UUID) -> None:
        role = user.get("role")
        if role not in ("trainer", "gym_admin"):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only trainers can manage athlete data")
        trainer_org = self._org_id(user)
        if trainer_org is not None:
            profile = await self._profile_repo.get_by_user(athlete_id)
            if profile is not None and profile.organization_id is not None and profile.organization_id != trainer_org:
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Athlete is not in your organization")

    # ── Profile ───────────────────────────────────────────────────────────────

    async def get_profile(self, user: CurrentUser) -> AthleteProfileResponse:
        user_id = self._user_id(user)
        profile = await self._profile_repo.get_by_user(user_id)
        if profile is None:
            profile = await self._profile_repo.create(
                user_id=user_id,
                organization_id=self._org_id(user),
            )
        return AthleteProfileResponse.model_validate(profile)

    async def update_profile(self, user: CurrentUser, data: AthleteProfileUpdate) -> AthleteProfileResponse:
        fields = data.model_dump(exclude_none=True)
        profile = await self._profile_repo.upsert(
            user_id=self._user_id(user),
            organization_id=self._org_id(user),
            **fields,
        )
        return AthleteProfileResponse.model_validate(profile)

    # ── Measurements ──────────────────────────────────────────────────────────

    async def list_measurements(
        self, user: CurrentUser, limit: int = 50, offset: int = 0
    ) -> list[BodyMeasurementResponse]:
        measurements = await self._measurement_repo.list_for_user(
            self._user_id(user), limit=limit, offset=offset
        )
        return [BodyMeasurementResponse.model_validate(m) for m in measurements]

    async def create_measurement(
        self, user: CurrentUser, data: BodyMeasurementCreate
    ) -> BodyMeasurementResponse:
        fields = data.model_dump(exclude_none=True)
        m = await self._measurement_repo.create(
            user_id=self._user_id(user),
            organization_id=self._org_id(user),
            **fields,
        )
        return BodyMeasurementResponse.model_validate(m)

    async def update_measurement(
        self, user: CurrentUser, measurement_id: uuid.UUID, data: BodyMeasurementUpdate
    ) -> BodyMeasurementResponse:
        m = await self._measurement_repo.get_by_id(measurement_id)
        if not m:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Measurement not found")
        if m.user_id != self._user_id(user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your measurement")
        fields = data.model_dump(exclude_unset=True)
        m = await self._measurement_repo.update(m, **fields)
        return BodyMeasurementResponse.model_validate(m)

    async def delete_measurement(self, user: CurrentUser, measurement_id: uuid.UUID) -> None:
        m = await self._measurement_repo.get_by_id(measurement_id)
        if not m:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Measurement not found")
        if m.user_id != self._user_id(user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your measurement")
        await self._measurement_repo.delete(m)

    # ── Trainer-scoped profile ────────────────────────────────────────────────

    async def get_athlete_profile(self, user: CurrentUser, athlete_id: uuid.UUID) -> AthleteProfileResponse:
        await self._ensure_trainer_access(user, athlete_id)
        profile = await self._profile_repo.get_by_user(athlete_id)
        if profile is None:
            profile = await self._profile_repo.create(
                user_id=athlete_id, organization_id=self._org_id(user)
            )
        return AthleteProfileResponse.model_validate(profile)

    async def update_athlete_profile(
        self, user: CurrentUser, athlete_id: uuid.UUID, data: AthleteProfileUpdate
    ) -> AthleteProfileResponse:
        await self._ensure_trainer_access(user, athlete_id)
        fields = data.model_dump(exclude_none=True)
        profile = await self._profile_repo.upsert(
            user_id=athlete_id, organization_id=self._org_id(user), **fields
        )
        return AthleteProfileResponse.model_validate(profile)

    # ── Trainer-scoped measurements ───────────────────────────────────────────

    async def list_athlete_measurements(
        self, user: CurrentUser, athlete_id: uuid.UUID, limit: int = 50, offset: int = 0
    ) -> list[BodyMeasurementResponse]:
        await self._ensure_trainer_access(user, athlete_id)
        measurements = await self._measurement_repo.list_for_user(athlete_id, limit=limit, offset=offset)
        return [BodyMeasurementResponse.model_validate(m) for m in measurements]

    async def create_athlete_measurement(
        self, user: CurrentUser, athlete_id: uuid.UUID, data: BodyMeasurementCreate
    ) -> BodyMeasurementResponse:
        await self._ensure_trainer_access(user, athlete_id)
        fields = data.model_dump(exclude_none=True)
        m = await self._measurement_repo.create(
            user_id=athlete_id, organization_id=self._org_id(user), **fields
        )
        return BodyMeasurementResponse.model_validate(m)

    async def update_athlete_measurement(
        self, user: CurrentUser, athlete_id: uuid.UUID, measurement_id: uuid.UUID, data: BodyMeasurementUpdate
    ) -> BodyMeasurementResponse:
        await self._ensure_trainer_access(user, athlete_id)
        m = await self._measurement_repo.get_by_id(measurement_id)
        if not m:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Measurement not found")
        if m.user_id != athlete_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Measurement does not belong to this athlete")
        m = await self._measurement_repo.update(m, **data.model_dump(exclude_unset=True))
        return BodyMeasurementResponse.model_validate(m)

    async def delete_athlete_measurement(
        self, user: CurrentUser, athlete_id: uuid.UUID, measurement_id: uuid.UUID
    ) -> None:
        await self._ensure_trainer_access(user, athlete_id)
        m = await self._measurement_repo.get_by_id(measurement_id)
        if not m:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Measurement not found")
        if m.user_id != athlete_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Measurement does not belong to this athlete")
        await self._measurement_repo.delete(m)
