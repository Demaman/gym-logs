import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import CurrentUser
from core.database import get_db
from core.redis import get_redis
from modules.identity.schemas import (
    LoginRequest,
    MembershipCreate,
    MembershipResponse,
    OrganizationCreate,
    OrganizationResponse,
    RefreshRequest,
    TokenResponse,
    UserCreate,
    UserResponse,
)
from modules.identity.services import IdentityService

router = APIRouter(prefix="/identity", tags=["identity"])


def _svc(
    db: AsyncSession = Depends(get_db),
) -> IdentityService:
    return IdentityService(session=db, redis=get_redis())


@router.post("/organizations", response_model=OrganizationResponse, status_code=201)
async def create_organization(
    data: OrganizationCreate,
    svc: IdentityService = Depends(_svc),
) -> OrganizationResponse:
    return await svc.create_organization(data)


@router.post("/auth/register", response_model=UserResponse, status_code=201)
async def register(
    data: UserCreate,
    svc: IdentityService = Depends(_svc),
) -> UserResponse:
    return await svc.register_user(data)


@router.post("/auth/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    svc: IdentityService = Depends(_svc),
) -> TokenResponse:
    return await svc.login(data.email, data.password)


@router.post("/auth/refresh", response_model=TokenResponse)
async def refresh(
    data: RefreshRequest,
    svc: IdentityService = Depends(_svc),
) -> TokenResponse:
    return await svc.refresh(data.refresh_token)


@router.post("/auth/logout", status_code=204)
async def logout(
    data: RefreshRequest,
    svc: IdentityService = Depends(_svc),
) -> None:
    await svc.logout(data.refresh_token)


@router.get("/users/me", response_model=UserResponse)
async def get_me(
    current_user: CurrentUser,
    svc: IdentityService = Depends(_svc),
) -> UserResponse:
    return await svc.get_me(user_id=uuid.UUID(current_user["user_id"]))


@router.post("/memberships", response_model=MembershipResponse, status_code=201)
async def create_membership(
    data: MembershipCreate,
    _: CurrentUser,
    svc: IdentityService = Depends(_svc),
) -> MembershipResponse:
    return await svc.create_membership(data)
