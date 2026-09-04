import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from core.api_key_auth import VALID_SCOPES


class ApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    scopes: list[str] = Field(..., min_length=1)  # min_length=1 means at least 1 item
    expires_at: datetime | None = None

    def model_post_init(self, __context) -> None:
        invalid = set(self.scopes) - VALID_SCOPES
        if invalid:
            raise ValueError(f"Unknown scopes: {sorted(invalid)}")


class ApiKeyResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    key_prefix: str
    scopes: list[str]
    is_active: bool
    last_used_at: datetime | None
    expires_at: datetime | None
    created_at: datetime


class ApiKeyCreatedResponse(ApiKeyResponse):
    """Returned only at creation — includes the plaintext key (shown once)."""

    plaintext_key: str = ""  # set by the service before returning
