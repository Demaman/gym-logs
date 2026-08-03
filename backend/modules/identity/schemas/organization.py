import uuid
from datetime import datetime

from pydantic import BaseModel


class OrganizationCreate(BaseModel):
    name: str
    cnpj: str | None = None
    phone: str | None = None
    contact_email: str | None = None
    address_street: str | None = None
    address_city: str | None = None
    address_state: str | None = None
    address_zip: str | None = None
    website: str | None = None


class OrganizationUpdate(BaseModel):
    name: str | None = None
    cnpj: str | None = None
    phone: str | None = None
    contact_email: str | None = None
    address_street: str | None = None
    address_city: str | None = None
    address_state: str | None = None
    address_zip: str | None = None
    website: str | None = None


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    cnpj: str | None = None
    phone: str | None = None
    contact_email: str | None = None
    address_street: str | None = None
    address_city: str | None = None
    address_state: str | None = None
    address_zip: str | None = None
    website: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
