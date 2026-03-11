from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, get_current_user, get_session_dependency
from app.schemas.common import UserResponse
from app.services.users import ensure_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session_dependency),
) -> UserResponse:
    user = await ensure_user(session, current_user.id, current_user.email)
    return UserResponse.model_validate(user)
