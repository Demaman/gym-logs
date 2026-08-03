import uuid
from datetime import datetime

from pydantic import BaseModel


class MembershipCreate(BaseModel):
    trainer_id: uuid.UUID
    athlete_id: uuid.UUID


class MembershipResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID | None
    trainer_id: uuid.UUID
    trainer_email: str
    athlete_id: uuid.UUID
    athlete_email: str
    created_at: datetime

    model_config = {"from_attributes": False}
