from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def ensure_user(session: AsyncSession, user_id: UUID, email: str) -> User:
    user = await session.get(User, user_id)
    if user is not None:
        return user

    user = User(id=user_id, email=email)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def get_user(session: AsyncSession, user_id: UUID) -> User | None:
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
