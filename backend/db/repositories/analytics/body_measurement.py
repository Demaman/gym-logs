import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.analytics.body_measurement import BodyMeasurement


class BodyMeasurementRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def get_by_id(self, measurement_id: uuid.UUID) -> BodyMeasurement | None:
        result = await self._s.execute(
            select(BodyMeasurement).where(BodyMeasurement.id == measurement_id)
        )
        return result.scalar_one_or_none()

    async def get_latest(self, user_id: uuid.UUID) -> BodyMeasurement | None:
        result = await self._s.execute(
            select(BodyMeasurement)
            .where(BodyMeasurement.user_id == user_id)
            .order_by(BodyMeasurement.measured_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> list[BodyMeasurement]:
        result = await self._s.execute(
            select(BodyMeasurement)
            .where(BodyMeasurement.user_id == user_id)
            .order_by(BodyMeasurement.measured_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def create(self, user_id: uuid.UUID, organization_id: uuid.UUID | None, **fields) -> BodyMeasurement:
        m = BodyMeasurement(user_id=user_id, organization_id=organization_id, **fields)
        self._s.add(m)
        await self._s.commit()
        await self._s.refresh(m)
        return m

    async def update(self, measurement: BodyMeasurement, **fields) -> BodyMeasurement:
        for key, value in fields.items():
            setattr(measurement, key, value)
        await self._s.commit()
        await self._s.refresh(measurement)
        return measurement

    async def delete(self, measurement: BodyMeasurement) -> None:
        await self._s.delete(measurement)
        await self._s.commit()
