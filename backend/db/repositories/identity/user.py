import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.identity.user import User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def create(
        self,
        *,
        email: str,
        hashed_password: str,
        role: str,
        organization_id: uuid.UUID | None,
    ) -> User:
        user = User(
            email=email,
            hashed_password=hashed_password,
            role=role,
            organization_id=organization_id,
        )
        self._s.add(user)
        await self._s.commit()
        await self._s.refresh(user)
        return user

    async def get_by_email(self, email: str) -> User | None:
        result = await self._s.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        """Trusted PK lookup — caller must supply a user_id from a verified JWT."""
        result = await self._s.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def list_by_org(self, organization_id: uuid.UUID) -> list[User]:
        result = await self._s.execute(
            select(User).where(User.organization_id == organization_id)
        )
        return list(result.scalars().all())

    async def update(self, user: User, **kwargs) -> User:
        for key, val in kwargs.items():
            setattr(user, key, val)
        await self._s.commit()
        await self._s.refresh(user)
        return user

    async def get_by_ids(self, user_ids: list[uuid.UUID]) -> list[User]:
        if not user_ids:
            return []
        result = await self._s.execute(select(User).where(User.id.in_(user_ids)))
        return list(result.scalars().all())
