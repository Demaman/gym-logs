import uuid

from pydantic import BaseModel


class GenerateProgramRequest(BaseModel):
    athlete_id: uuid.UUID | None = None
    notes: str | None = None
    locale: str = "en"
