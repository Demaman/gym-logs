import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from jose import JWTError
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import CurrentUser
from core.events import publish
from core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from db.constants.identity import Role
from db.models.identity.membership import Membership
from db.models.identity.user import User
from db.repositories.identity import (
    InviteRepository,
    MembershipRepository,
    OrganizationRepository,
    UserRepository,
)
from modules.identity.schemas import (
    InviteCreate,
    InviteResponse,
    MembershipCreate,
    MembershipResponse,
    OrgLookupResponse,
    OrganizationCreate,
    OrganizationResponse,
    OrganizationUpdate,
    PasswordChange,
    TokenResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
)

_REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7
_INVITE_TTL_DAYS = 7
_JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _generate_join_code() -> str:
    return "".join(secrets.choice(_JOIN_CODE_ALPHABET) for _ in range(6))


def _enrich_membership(
    membership: Membership, trainer: User, athlete: User
) -> MembershipResponse:
    return MembershipResponse(
        id=membership.id,
        organization_id=membership.organization_id,
        trainer_id=membership.trainer_id,
        trainer_email=trainer.email,
        athlete_id=membership.athlete_id,
        athlete_email=athlete.email,
        created_at=membership.created_at,
    )


class IdentityService:
    def __init__(self, session: AsyncSession, redis: Redis) -> None:
        self._org_repo = OrganizationRepository(session)
        self._user_repo = UserRepository(session)
        self._membership_repo = MembershipRepository(session)
        self._invite_repo = InviteRepository(session)
        self._redis = redis

    # ── helpers ──────────────────────────────────────────────────────────────

    def _uid(self, user: CurrentUser) -> uuid.UUID:
        return uuid.UUID(str(user["user_id"]))

    def _org_id(self, user: CurrentUser) -> uuid.UUID | None:
        val = user.get("organization_id")
        return uuid.UUID(str(val)) if val else None

    # ── organizations ─────────────────────────────────────────────────────────

    async def create_organization(self, data: OrganizationCreate) -> OrganizationResponse:
        extra = data.model_dump(exclude={"name"}, exclude_none=True)
        # Generate a unique join code, retrying on the rare collision.
        for _ in range(10):
            candidate = _generate_join_code()
            if not await self._org_repo.get_by_join_code(candidate):
                extra["join_code"] = candidate
                break
        org = await self._org_repo.create(name=data.name, **extra)
        await publish("organization.created", {"organization_id": str(org.id), "name": org.name})
        return OrganizationResponse.model_validate(org)

    async def get_organization_by_join_code(self, join_code: str) -> OrgLookupResponse:
        org = await self._org_repo.get_by_join_code(join_code.upper().strip())
        if not org:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No gym found with that code")
        return OrgLookupResponse(id=org.id, name=org.name)

    async def get_my_organization(self, user: CurrentUser) -> OrganizationResponse:
        org_id = self._org_id(user)
        if not org_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "You are not part of any organization")
        org = await self._org_repo.get_by_id(org_id)
        if not org:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
        return OrganizationResponse.model_validate(org)

    async def update_my_organization(self, user: CurrentUser, data: OrganizationUpdate) -> OrganizationResponse:
        if user.get("role") not in Role.STAFF:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only trainers and gym admins can update organization details")
        org_id = self._org_id(user)
        if not org_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "You are not part of any organization")
        org = await self._org_repo.get_by_id(org_id)
        if not org:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
        updated = await self._org_repo.update(org, **data.model_dump(exclude_unset=True))
        return OrganizationResponse.model_validate(updated)

    # ── auth ──────────────────────────────────────────────────────────────────

    async def register_user(self, data: UserCreate) -> UserResponse:
        if await self._user_repo.get_by_email(data.email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

        org_id = data.organization_id
        if data.join_code:
            org = await self._org_repo.get_by_join_code(data.join_code.upper().strip())
            if not org:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No gym found with that join code")
            org_id = org.id
        elif org_id is not None:
            if not await self._org_repo.get_by_id(org_id):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

        user = await self._user_repo.create(
            email=data.email,
            hashed_password=hash_password(data.password),
            role=data.role,
            organization_id=org_id,
        )
        await publish("user.registered", {
            "user_id": str(user.id),
            "organization_id": str(user.organization_id) if user.organization_id else None,
            "role": user.role,
        })
        return UserResponse.model_validate(user)

    async def login(self, email: str, password: str) -> TokenResponse:
        user = await self._user_repo.get_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        token_data = {
            "sub": str(user.id),
            "org": str(user.organization_id) if user.organization_id else None,
            "role": user.role,
        }
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        await self._redis.set(f"refresh:{refresh_token}", str(user.id), ex=_REFRESH_TTL_SECONDS)
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)

    async def refresh(self, refresh_token: str) -> TokenResponse:
        stored = await self._redis.get(f"refresh:{refresh_token}")
        if not stored:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
        try:
            payload = decode_token(refresh_token)
        except JWTError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        # Re-read user from DB so token always reflects current org/role.
        user = await self._user_repo.get_by_id(uuid.UUID(payload["sub"]))
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        await self._redis.delete(f"refresh:{refresh_token}")
        token_data = {
            "sub": str(user.id),
            "org": str(user.organization_id) if user.organization_id else None,
            "role": user.role,
        }
        new_access = create_access_token(token_data)
        new_refresh = create_refresh_token(token_data)
        await self._redis.set(f"refresh:{new_refresh}", stored, ex=_REFRESH_TTL_SECONDS)
        return TokenResponse(access_token=new_access, refresh_token=new_refresh)

    async def logout(self, refresh_token: str) -> None:
        await self._redis.delete(f"refresh:{refresh_token}")

    # ── users ─────────────────────────────────────────────────────────────────

    async def get_me(self, user_id: uuid.UUID) -> UserResponse:
        user = await self._user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return UserResponse.model_validate(user)

    async def update_me(self, user: CurrentUser, data: UserUpdate) -> UserResponse:
        uid = self._uid(user)
        db_user = await self._user_repo.get_by_id(uid)
        if not db_user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        fields = data.model_dump(exclude_none=True)
        if "email" in fields:
            existing = await self._user_repo.get_by_email(fields["email"])
            if existing and existing.id != db_user.id:
                raise HTTPException(status.HTTP_409_CONFLICT, "Email already in use")
        updated = await self._user_repo.update(db_user, **fields)
        return UserResponse.model_validate(updated)

    async def change_password(self, user: CurrentUser, data: PasswordChange) -> None:
        uid = self._uid(user)
        db_user = await self._user_repo.get_by_id(uid)
        if not db_user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        if not verify_password(data.current_password, db_user.hashed_password):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
        await self._user_repo.update(db_user, hashed_password=hash_password(data.new_password))

    # ── memberships ───────────────────────────────────────────────────────────

    async def create_membership(self, data: MembershipCreate) -> MembershipResponse:
        trainer = await self._user_repo.get_by_id(data.trainer_id)
        if not trainer or trainer.role not in Role.STAFF:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="trainer_id must be a trainer or gym_admin")
        athlete = await self._user_repo.get_by_id(data.athlete_id)
        if not athlete or athlete.role != Role.ATHLETE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="athlete_id must be an athlete")
        if trainer.organization_id != athlete.organization_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trainer and athlete must be in the same space (same organization, or both independent)")
        membership = await self._membership_repo.create(
            organization_id=trainer.organization_id,
            trainer_id=data.trainer_id,
            athlete_id=data.athlete_id,
        )
        await publish("membership.created", {
            "membership_id": str(membership.id),
            "organization_id": str(membership.organization_id) if membership.organization_id else None,
            "trainer_id": str(membership.trainer_id),
            "athlete_id": str(membership.athlete_id),
        })
        return _enrich_membership(membership, trainer, athlete)

    async def list_trainers_for_org(self, user: CurrentUser) -> list[UserResponse]:
        if user.get("role") != Role.GYM_ADMIN:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only gym admins can list trainers")
        org_id = self._org_id(user)
        if not org_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "You must belong to an organization")
        all_users = await self._user_repo.list_by_org(org_id)
        trainers = [u for u in all_users if u.role in Role.STAFF]
        return [UserResponse.model_validate(t) for t in trainers]

    async def list_athletes_for_trainer(self, user: CurrentUser) -> list[UserResponse]:
        """Returns only athletes explicitly linked to this trainer via memberships."""
        if user.get("role") not in Role.STAFF:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only trainers can list athletes")
        trainer_id = self._uid(user)
        org_id = self._org_id(user)
        memberships = await self._membership_repo.list_by_trainer(trainer_id, org_id)
        athlete_ids = [m.athlete_id for m in memberships]
        athletes = await self._user_repo.get_by_ids(athlete_ids)
        return [UserResponse.model_validate(a) for a in athletes]

    async def list_memberships_for_trainer(self, user: CurrentUser) -> list[MembershipResponse]:
        if user.get("role") not in Role.STAFF:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only trainers can list memberships")
        trainer_id = self._uid(user)
        org_id = self._org_id(user)
        memberships = await self._membership_repo.list_by_trainer(trainer_id, org_id)
        athlete_ids = [m.athlete_id for m in memberships]
        athletes = {a.id: a for a in await self._user_repo.get_by_ids(athlete_ids)}
        trainer_user = await self._user_repo.get_by_id(trainer_id)
        if not trainer_user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Trainer not found")
        return [
            _enrich_membership(m, trainer_user, athletes[m.athlete_id])
            for m in memberships
            if m.athlete_id in athletes
        ]

    async def list_org_memberships(self, user: CurrentUser) -> list[MembershipResponse]:
        if user.get("role") != Role.GYM_ADMIN:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only gym admins can list all org memberships")
        org_id = self._org_id(user)
        if not org_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "You are not part of any organization")
        memberships = await self._membership_repo.list_by_org(org_id)
        all_user_ids = list({m.trainer_id for m in memberships} | {m.athlete_id for m in memberships})
        users = {u.id: u for u in await self._user_repo.get_by_ids(all_user_ids)}
        return [
            _enrich_membership(m, users[m.trainer_id], users[m.athlete_id])
            for m in memberships
            if m.trainer_id in users and m.athlete_id in users
        ]

    async def get_my_trainer(self, user: CurrentUser) -> MembershipResponse | None:
        if user.get("role") != Role.ATHLETE:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only athletes can view their trainer")
        athlete_id = self._uid(user)
        org_id = self._org_id(user)
        memberships = await self._membership_repo.list_by_athlete(athlete_id, org_id)
        if not memberships:
            return None
        m = memberships[0]
        trainer_user = await self._user_repo.get_by_id(m.trainer_id)
        athlete_user = await self._user_repo.get_by_id(athlete_id)
        if not trainer_user or not athlete_user:
            return None
        return _enrich_membership(m, trainer_user, athlete_user)

    async def delete_membership(self, user: CurrentUser, membership_id: uuid.UUID) -> None:
        membership = await self._membership_repo.get_by_id(membership_id)
        if not membership:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Membership not found")
        uid = self._uid(user)
        role = user.get("role")
        org_id = self._org_id(user)
        is_trainer_owner = membership.trainer_id == uid
        is_admin = role == Role.GYM_ADMIN and membership.organization_id == org_id
        if not is_trainer_owner and not is_admin:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to delete this membership")
        athlete = await self._user_repo.get_by_id(membership.athlete_id)
        if athlete and athlete.organization_id == membership.organization_id:
            await self._user_repo.update(athlete, organization_id=None)
        await self._membership_repo.delete(membership)

    async def leave_organization(self, user: CurrentUser) -> None:
        if user.get("role") != Role.ATHLETE:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only athletes can leave an organization")
        uid = self._uid(user)
        db_user = await self._user_repo.get_by_id(uid)
        if not db_user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        if not db_user.organization_id:
            raise HTTPException(status.HTTP_409_CONFLICT, "You are not part of any organization")
        memberships = await self._membership_repo.list_by_athlete(uid, db_user.organization_id)
        for m in memberships:
            await self._membership_repo.delete(m)
        await self._user_repo.update(db_user, organization_id=None)

    # ── invites ───────────────────────────────────────────────────────────────

    async def invite_member(self, user: CurrentUser, data: InviteCreate) -> InviteResponse:
        if user.get("role") not in Role.STAFF:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only trainers and gym admins can send invites")
        org_id = self._org_id(user)
        if not org_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "You must belong to an organization to send invites")
        trainer_id = self._uid(user)
        email = data.email.lower()

        existing_user = await self._user_repo.get_by_email(email)
        if existing_user:
            if existing_user.organization_id == org_id:
                raise HTTPException(status.HTTP_409_CONFLICT, "User is already in your organization")
            if existing_user.organization_id is not None:
                raise HTTPException(status.HTTP_409_CONFLICT, "User belongs to another organization")

        existing_invite = await self._invite_repo.get_pending_by_email_and_org(email, org_id)
        if existing_invite:
            raise HTTPException(status.HTTP_409_CONFLICT, "A pending invite already exists for this email")

        invite = await self._invite_repo.create(
            organization_id=org_id,
            invited_by_id=trainer_id,
            email=email,
            role=data.role,
            expires_at=datetime.now(UTC) + timedelta(days=_INVITE_TTL_DAYS),
            pre_filled_data=data.pre_filled_data,
        )
        await publish("membership.invitation_sent", {
            "invite_id": str(invite.id),
            "organization_id": str(org_id),
            "email": email,
            "role": data.role,
        })
        return InviteResponse.model_validate(invite)

    async def list_pending_invites(self, user: CurrentUser) -> list[InviteResponse]:
        if user.get("role") not in Role.STAFF:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only trainers and gym admins can view invites")
        org_id = self._org_id(user)
        if not org_id:
            return []
        invites = await self._invite_repo.list_by_org(org_id)
        return [InviteResponse.model_validate(i) for i in invites]

    async def list_my_invites(self, user: CurrentUser) -> list[InviteResponse]:
        """Athlete: pending invites addressed to their email, enriched with org name."""
        if user.get("role") != Role.ATHLETE:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only athletes can view their own invites")  # noqa: E501
        uid = self._uid(user)
        db_user = await self._user_repo.get_by_id(uid)
        if not db_user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        invites = await self._invite_repo.list_pending_by_email(db_user.email)
        results = []
        for invite in invites:
            org = await self._org_repo.get_by_id(invite.organization_id)
            resp = InviteResponse.model_validate(invite)
            resp.organization_name = org.name if org else None
            results.append(resp)
        return results

    async def accept_invite(self, user: CurrentUser, invite_id: uuid.UUID) -> None:
        if user.get("role") != Role.ATHLETE:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only athletes can accept invites")  # noqa: E501
        uid = self._uid(user)
        db_user = await self._user_repo.get_by_id(uid)
        if not db_user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        invite = await self._invite_repo.get_by_id(invite_id)
        if not invite:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found")
        if invite.email != db_user.email.lower():
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This invite is not for you")
        if invite.accepted_at is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Invite already accepted")
        if invite.expires_at < datetime.now(UTC):
            raise HTTPException(status.HTTP_410_GONE, "Invite has expired")
        if db_user.organization_id is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "You already belong to an organization")  # noqa: E501
        await self._user_repo.update(db_user, organization_id=invite.organization_id)
        await self._invite_repo.accept(invite)
        # Only create a trainer↔athlete membership when the inviter is a trainer.
        # Gym-admin invites link the athlete to the org only; trainer assignment
        # happens separately.
        inviter = await self._user_repo.get_by_id(invite.invited_by_id)
        if inviter and inviter.role == Role.TRAINER:
            membership = await self._membership_repo.create(
                organization_id=invite.organization_id,
                trainer_id=invite.invited_by_id,
                athlete_id=uid,
            )
            await publish("membership.created", {
                "membership_id": str(membership.id),
                "organization_id": str(invite.organization_id),
                "trainer_id": str(invite.invited_by_id),
                "athlete_id": str(uid),
            })

    async def decline_invite(self, user: CurrentUser, invite_id: uuid.UUID) -> None:
        if user.get("role") != Role.ATHLETE:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only athletes can decline invites")  # noqa: E501
        uid = self._uid(user)
        db_user = await self._user_repo.get_by_id(uid)
        if not db_user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        invite = await self._invite_repo.get_by_id(invite_id)
        if not invite:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found")
        if invite.email != db_user.email.lower():
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This invite is not for you")
        await self._invite_repo.delete(invite)

    async def delete_invite(self, user: CurrentUser, invite_id: uuid.UUID) -> None:
        invite = await self._invite_repo.get_by_id(invite_id)
        if not invite:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found")
        org_id = self._org_id(user)
        uid = self._uid(user)
        role = user.get("role")
        is_inviter = invite.invited_by_id == uid
        is_admin = role == Role.GYM_ADMIN and invite.organization_id == org_id
        if not is_inviter and not is_admin:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to cancel this invite")
        await self._invite_repo.delete(invite)
