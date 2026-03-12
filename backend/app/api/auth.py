from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, get_current_user, get_session_dependency
from app.schemas.auth import (
    AuthenticatedUserResponse,
    DemoUserCredentials,
    DemoUsersResponse,
    LoginRequest,
    LoginResponse,
)
from app.services.auth import authenticate_demo_user, create_access_token, list_demo_users
from app.services.users import ensure_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/test-users", response_model=DemoUsersResponse)
async def get_test_users() -> DemoUsersResponse:
    return DemoUsersResponse(
        users=[
            DemoUserCredentials(
                id=user.id,
                email=user.email,
                password=user.password,
                tenant_name=user.tenant_name,
            )
            for user in list_demo_users()
        ]
    )


@router.post("/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_session_dependency),
) -> LoginResponse:
    demo_user = authenticate_demo_user(payload.email, payload.password)
    if demo_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user = await ensure_user(session, demo_user.id, demo_user.email)
    access_token, expires_at = create_access_token(user=demo_user)
    return LoginResponse(
        access_token=access_token,
        expires_at=expires_at,
        user=AuthenticatedUserResponse(
            id=user.id,
            email=user.email,
            created_at=user.created_at,
            tenant_name=demo_user.tenant_name,
        ),
    )


@router.get("/me", response_model=AuthenticatedUserResponse)
async def get_authenticated_user(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session_dependency),
) -> AuthenticatedUserResponse:
    user = await ensure_user(session, current_user.id, current_user.email)
    return AuthenticatedUserResponse(
        id=user.id,
        email=user.email,
        created_at=user.created_at,
        tenant_name=current_user.tenant_name,
    )
