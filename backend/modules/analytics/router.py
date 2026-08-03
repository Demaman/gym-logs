import uuid

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import CurrentUser
from core.database import get_db
from modules.analytics.schemas import (
    AthleteProfileResponse,
    AthleteProfileUpdate,
    BodyMeasurementCreate,
    BodyMeasurementResponse,
    BodyMeasurementUpdate,
)
from modules.analytics.services import AnamnesisService

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _svc(session: AsyncSession = Depends(get_db)) -> AnamnesisService:
    return AnamnesisService(session)


# ── Athlete profile ───────────────────────────────────────────────────────────

@router.get("/profile", response_model=AthleteProfileResponse)
async def get_profile(
    current_user: CurrentUser,
    svc: AnamnesisService = Depends(_svc),
) -> AthleteProfileResponse:
    return await svc.get_profile(current_user)


@router.put("/profile", response_model=AthleteProfileResponse)
async def update_profile(
    data: AthleteProfileUpdate,
    current_user: CurrentUser,
    svc: AnamnesisService = Depends(_svc),
) -> AthleteProfileResponse:
    return await svc.update_profile(current_user, data)


# ── Body measurements ─────────────────────────────────────────────────────────

@router.get("/measurements", response_model=list[BodyMeasurementResponse])
async def list_measurements(
    current_user: CurrentUser,
    svc: AnamnesisService = Depends(_svc),
    limit: int = 50,
    offset: int = 0,
) -> list[BodyMeasurementResponse]:
    return await svc.list_measurements(current_user, limit=limit, offset=offset)


@router.post("/measurements", response_model=BodyMeasurementResponse, status_code=201)
async def create_measurement(
    data: BodyMeasurementCreate,
    current_user: CurrentUser,
    svc: AnamnesisService = Depends(_svc),
) -> BodyMeasurementResponse:
    return await svc.create_measurement(current_user, data)


@router.patch("/measurements/{measurement_id}", response_model=BodyMeasurementResponse)
async def update_measurement(
    measurement_id: uuid.UUID,
    data: BodyMeasurementUpdate,
    current_user: CurrentUser,
    svc: AnamnesisService = Depends(_svc),
) -> BodyMeasurementResponse:
    return await svc.update_measurement(current_user, measurement_id, data)


@router.delete("/measurements/{measurement_id}", status_code=204)
async def delete_measurement(
    measurement_id: uuid.UUID,
    current_user: CurrentUser,
    svc: AnamnesisService = Depends(_svc),
) -> Response:
    await svc.delete_measurement(current_user, measurement_id)
    return Response(status_code=204)


# ── Trainer-scoped routes ─────────────────────────────────────────────────────

@router.get("/athletes/{athlete_id}/profile", response_model=AthleteProfileResponse)
async def get_athlete_profile(
    athlete_id: uuid.UUID,
    current_user: CurrentUser,
    svc: AnamnesisService = Depends(_svc),
) -> AthleteProfileResponse:
    return await svc.get_athlete_profile(current_user, athlete_id)


@router.put("/athletes/{athlete_id}/profile", response_model=AthleteProfileResponse)
async def update_athlete_profile(
    athlete_id: uuid.UUID,
    data: AthleteProfileUpdate,
    current_user: CurrentUser,
    svc: AnamnesisService = Depends(_svc),
) -> AthleteProfileResponse:
    return await svc.update_athlete_profile(current_user, athlete_id, data)


@router.get("/athletes/{athlete_id}/measurements", response_model=list[BodyMeasurementResponse])
async def list_athlete_measurements(
    athlete_id: uuid.UUID,
    current_user: CurrentUser,
    svc: AnamnesisService = Depends(_svc),
    limit: int = 50,
    offset: int = 0,
) -> list[BodyMeasurementResponse]:
    return await svc.list_athlete_measurements(current_user, athlete_id, limit=limit, offset=offset)


@router.post("/athletes/{athlete_id}/measurements", response_model=BodyMeasurementResponse, status_code=201)
async def create_athlete_measurement(
    athlete_id: uuid.UUID,
    data: BodyMeasurementCreate,
    current_user: CurrentUser,
    svc: AnamnesisService = Depends(_svc),
) -> BodyMeasurementResponse:
    return await svc.create_athlete_measurement(current_user, athlete_id, data)


@router.patch("/athletes/{athlete_id}/measurements/{measurement_id}", response_model=BodyMeasurementResponse)
async def update_athlete_measurement(
    athlete_id: uuid.UUID,
    measurement_id: uuid.UUID,
    data: BodyMeasurementUpdate,
    current_user: CurrentUser,
    svc: AnamnesisService = Depends(_svc),
) -> BodyMeasurementResponse:
    return await svc.update_athlete_measurement(current_user, athlete_id, measurement_id, data)


@router.delete("/athletes/{athlete_id}/measurements/{measurement_id}", status_code=204)
async def delete_athlete_measurement(
    athlete_id: uuid.UUID,
    measurement_id: uuid.UUID,
    current_user: CurrentUser,
    svc: AnamnesisService = Depends(_svc),
) -> Response:
    await svc.delete_athlete_measurement(current_user, athlete_id, measurement_id)
    return Response(status_code=204)
