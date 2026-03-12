from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import UserResponse


class AuthenticatedUserResponse(UserResponse):
    tenant_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class DemoUserCredentials(BaseModel):
    id: UUID
    email: str
    password: str
    tenant_name: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: AuthenticatedUserResponse


class DemoUsersResponse(BaseModel):
    users: list[DemoUserCredentials]
