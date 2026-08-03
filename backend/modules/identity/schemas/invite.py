import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class InviteCreate(BaseModel):
    email: EmailStr
    role: str = "athlete"
    pre_filled_data: dict | None = None


class InviteResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    organization_name: str | None = None
    email: str
    role: str
    expires_at: datetime
    accepted_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
