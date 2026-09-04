from pydantic import BaseModel, Field


class PartnerConfigCreate(BaseModel):
    external_gym_id: str = Field(..., min_length=1, max_length=64)
    bearer_token: str = Field(..., min_length=1, max_length=512)
    # Minimum 16 chars to ensure adequate entropy for HMAC signing
    webhook_secret: str = Field(..., min_length=16, max_length=256)


class PartnerConfigResponse(BaseModel):
    model_config = {"from_attributes": True}

    platform: str
    external_gym_id: str
    is_active: bool
    # NOTE: bearer_token and webhook_secret are intentionally omitted


class PartnerLinkMemberRequest(BaseModel):
    user_id: str
    external_member_id: str = Field(..., min_length=1, max_length=64)


class PartnerMemberResponse(BaseModel):
    model_config = {"from_attributes": True}

    user_id: str
    external_member_id: str


class PartnerValidateRequest(BaseModel):
    external_member_id: str = Field(..., min_length=1, max_length=64)


class PartnerValidateResponse(BaseModel):
    recorded: bool
    external_member_id: str
    message: str


class PartnerWebhookResponse(BaseModel):
    status: str = "ok"
