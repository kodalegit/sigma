from collections.abc import AsyncGenerator
from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db.session import get_db_session


@dataclass(slots=True)
class CurrentUser:
    id: UUID
    email: str


def get_current_user(settings: Settings = Depends(get_settings)) -> CurrentUser:
    return CurrentUser(id=UUID(settings.auth_stub_user_id), email=settings.auth_stub_user_email)


async def get_session_dependency(
    session: AsyncSession = Depends(get_db_session),
) -> AsyncGenerator[AsyncSession, None]:
    yield session
