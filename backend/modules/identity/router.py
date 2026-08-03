import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import CurrentUser
from core.database import get_db
from core.redis import get_redis
from modules.identity.schemas import (
    InviteCreate,
    InviteResponse,
    LoginRequest,
    MembershipCreate,
    MembershipResponse,
    OrgLookupResponse,
    OrganizationCreate,
    OrganizationResponse,
    OrganizationUpdate,
    PasswordChange,
    RefreshRequest,
    TokenResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from modules.identity.services import IdentityService

router = APIRouter(prefix="/identity", tags=["identity"])


def _svc(db: AsyncSession = Depends(get_db)) -> IdentityService:
    return IdentityService(session=db, redis=get_redis())


@router.post("/organizations", response_model=OrganizationResponse, status_code=201)
async def create_organization(data: OrganizationCreate, svc: IdentityService = Depends(_svc)) -> OrganizationResponse:
    return await svc.create_organization(data)


# /organizations/by-code must come BEFORE /organizations/current to avoid ambiguity
@router.get("/organizations/by-code/{code}", response_model=OrgLookupResponse)
async def lookup_org_by_join_code(code: str, svc: IdentityService = Depends(_svc)) -> OrgLookupResponse:
    return await svc.get_organization_by_join_code(code)


@router.post("/auth/register", response_model=UserResponse, status_code=201)
async def register(data: UserCreate, svc: IdentityService = Depends(_svc)) -> UserResponse:
    return await svc.register_user(data)


@router.post("/auth/login", response_model=TokenResponse)
async def login(data: LoginRequest, svc: IdentityService = Depends(_svc)) -> TokenResponse:
    return await svc.login(data.email, data.password)


@router.post("/auth/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, svc: IdentityService = Depends(_svc)) -> TokenResponse:
    return await svc.refresh(data.refresh_token)


@router.post("/auth/logout", status_code=204)
async def logout(data: RefreshRequest, svc: IdentityService = Depends(_svc)) -> None:
    await svc.logout(data.refresh_token)


@router.get("/users/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser, svc: IdentityService = Depends(_svc)) -> UserResponse:
    return await svc.get_me(user_id=uuid.UUID(current_user["user_id"]))


@router.patch("/users/me", response_model=UserResponse)
async def update_me(data: UserUpdate, current_user: CurrentUser, svc: IdentityService = Depends(_svc)) -> UserResponse:
    return await svc.update_me(current_user, data)


@router.post("/users/me/password", status_code=204)
async def change_password(data: PasswordChange, current_user: CurrentUser, svc: IdentityService = Depends(_svc)) -> None:
    await svc.change_password(current_user, data)


@router.get("/organizations/current", response_model=OrganizationResponse)
async def get_my_organization(current_user: CurrentUser, svc: IdentityService = Depends(_svc)) -> OrganizationResponse:
    return await svc.get_my_organization(current_user)


@router.patch("/organizations/current", response_model=OrganizationResponse)
async def update_my_organization(data: OrganizationUpdate, current_user: CurrentUser, svc: IdentityService = Depends(_svc)) -> OrganizationResponse:
    return await svc.update_my_organization(current_user, data)


@router.get("/members/trainers", response_model=list[UserResponse])
async def list_trainers(
    current_user: CurrentUser, svc: IdentityService = Depends(_svc)
) -> list[UserResponse]:
    return await svc.list_trainers_for_org(current_user)


@router.get("/members/athletes", response_model=list[UserResponse])
async def list_athletes(current_user: CurrentUser, svc: IdentityService = Depends(_svc)) -> list[UserResponse]:
    return await svc.list_athletes_for_trainer(current_user)


@router.get("/members/my-trainer", response_model=MembershipResponse | None)
async def get_my_trainer(current_user: CurrentUser, svc: IdentityService = Depends(_svc)) -> MembershipResponse | None:
    return await svc.get_my_trainer(current_user)


@router.post("/members/leave", status_code=204)
async def leave_organization(current_user: CurrentUser, svc: IdentityService = Depends(_svc)) -> None:
    await svc.leave_organization(current_user)


@router.post("/memberships", response_model=MembershipResponse, status_code=201)
async def create_membership(data: MembershipCreate, _: CurrentUser, svc: IdentityService = Depends(_svc)) -> MembershipResponse:
    return await svc.create_membership(data)


# /memberships/mine must come BEFORE /memberships/{id} to avoid "mine" matching as a UUID
@router.get("/memberships/mine", response_model=list[MembershipResponse])
async def list_my_memberships(current_user: CurrentUser, svc: IdentityService = Depends(_svc)) -> list[MembershipResponse]:
    return await svc.list_memberships_for_trainer(current_user)


@router.get("/memberships", response_model=list[MembershipResponse])
async def list_org_memberships(current_user: CurrentUser, svc: IdentityService = Depends(_svc)) -> list[MembershipResponse]:
    return await svc.list_org_memberships(current_user)


@router.delete("/memberships/{membership_id}", status_code=204)
async def delete_membership(membership_id: uuid.UUID, current_user: CurrentUser, svc: IdentityService = Depends(_svc)) -> None:
    await svc.delete_membership(current_user, membership_id)


@router.post("/invites", response_model=InviteResponse, status_code=201)
async def invite_member(data: InviteCreate, current_user: CurrentUser, svc: IdentityService = Depends(_svc)) -> InviteResponse:
    return await svc.invite_member(current_user, data)


@router.get("/invites", response_model=list[InviteResponse])
async def list_invites(current_user: CurrentUser, svc: IdentityService = Depends(_svc)) -> list[InviteResponse]:
    return await svc.list_pending_invites(current_user)


# /invites/mine must come BEFORE /invites/{invite_id} to avoid "mine" matching as a UUID
@router.get("/invites/mine", response_model=list[InviteResponse])
async def list_my_invites(current_user: CurrentUser, svc: IdentityService = Depends(_svc)) -> list[InviteResponse]:
    return await svc.list_my_invites(current_user)


@router.post("/invites/{invite_id}/accept", status_code=204)
async def accept_invite(invite_id: uuid.UUID, current_user: CurrentUser, svc: IdentityService = Depends(_svc)) -> None:
    await svc.accept_invite(current_user, invite_id)


@router.post("/invites/{invite_id}/decline", status_code=204)
async def decline_invite(invite_id: uuid.UUID, current_user: CurrentUser, svc: IdentityService = Depends(_svc)) -> None:
    await svc.decline_invite(current_user, invite_id)


@router.delete("/invites/{invite_id}", status_code=204)
async def delete_invite(invite_id: uuid.UUID, current_user: CurrentUser, svc: IdentityService = Depends(_svc)) -> None:
    await svc.delete_invite(current_user, invite_id)
