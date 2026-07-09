import uuid

from fastapi import HTTPException, status
from jose import JWTError
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from core.events import publish
from core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from db.constants.identity import Role
from db.repositories.identity import (
    MembershipRepository,
    OrganizationRepository,
    UserRepository,
)
from modules.identity.schemas import (
    MembershipCreate,
    MembershipResponse,
    OrganizationCreate,
    OrganizationResponse,
    TokenResponse,
    UserCreate,
    UserResponse,
)

_REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7


class IdentityService:
    def __init__(self, session: AsyncSession, redis: Redis) -> None:
        self._org_repo = OrganizationRepository(session)
        self._user_repo = UserRepository(session)
        self._membership_repo = MembershipRepository(session)
        self._redis = redis

    async def create_organization(
        self, data: OrganizationCreate
    ) -> OrganizationResponse:
        org = await self._org_repo.create(name=data.name)
        await publish(
            "organization.created",
            {"organization_id": str(org.id), "name": org.name},
        )
        return OrganizationResponse.model_validate(org)

    async def register_user(self, data: UserCreate) -> UserResponse:
        if await self._user_repo.get_by_email(data.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )
        if data.organization_id is not None:
            if not await self._org_repo.get_by_id(data.organization_id):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Organization not found",
                )
        user = await self._user_repo.create(
            email=data.email,
            hashed_password=hash_password(data.password),
            role=data.role,
            organization_id=data.organization_id,
        )
        await publish(
            "user.registered",
            {
                "user_id": str(user.id),
                "organization_id": str(user.organization_id)
                if user.organization_id
                else None,
                "role": user.role,
            },
        )
        return UserResponse.model_validate(user)

    async def login(self, email: str, password: str) -> TokenResponse:
        user = await self._user_repo.get_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )
        token_data = {
            "sub": str(user.id),
            "org": str(user.organization_id) if user.organization_id else None,
            "role": user.role,
        }
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        await self._redis.set(
            f"refresh:{refresh_token}", str(user.id), ex=_REFRESH_TTL_SECONDS
        )
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)

    async def refresh(self, refresh_token: str) -> TokenResponse:
        stored = await self._redis.get(f"refresh:{refresh_token}")
        if not stored:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
            )
        try:
            payload = decode_token(refresh_token)
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
        await self._redis.delete(f"refresh:{refresh_token}")
        token_data = {
            "sub": payload["sub"],
            "org": payload.get("org"),
            "role": payload["role"],
        }
        new_access = create_access_token(token_data)
        new_refresh = create_refresh_token(token_data)
        await self._redis.set(f"refresh:{new_refresh}", stored, ex=_REFRESH_TTL_SECONDS)
        return TokenResponse(access_token=new_access, refresh_token=new_refresh)

    async def logout(self, refresh_token: str) -> None:
        await self._redis.delete(f"refresh:{refresh_token}")

    async def get_me(self, user_id: uuid.UUID) -> UserResponse:
        user = await self._user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )
        return UserResponse.model_validate(user)

    async def create_membership(self, data: MembershipCreate) -> MembershipResponse:
        trainer = await self._user_repo.get_by_id(data.trainer_id)
        if not trainer or trainer.role not in Role.STAFF:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="trainer_id must be a trainer or gym_admin",
            )
        athlete = await self._user_repo.get_by_id(data.athlete_id)
        if not athlete or athlete.role != Role.ATHLETE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="athlete_id must be an athlete",
            )
        if trainer.organization_id != athlete.organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Trainer and athlete must be in the same space "
                    "(same organization, or both independent)"
                ),
            )
        membership = await self._membership_repo.create(
            organization_id=trainer.organization_id,
            trainer_id=data.trainer_id,
            athlete_id=data.athlete_id,
        )
        await publish(
            "membership.created",
            {
                "membership_id": str(membership.id),
                "organization_id": str(membership.organization_id)
                if membership.organization_id
                else None,
                "trainer_id": str(membership.trainer_id),
                "athlete_id": str(membership.athlete_id),
            },
        )
        return MembershipResponse.model_validate(membership)
