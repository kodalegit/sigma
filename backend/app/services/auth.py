from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from fastapi import HTTPException, status

from app.config import get_settings

settings = get_settings()


@dataclass(frozen=True, slots=True)
class DemoUser:
    id: UUID
    email: str
    password: str
    tenant_name: str


DEMO_USERS: tuple[DemoUser, ...] = (
    DemoUser(
        id=UUID("00000000-0000-0000-0000-000000000001"),
        email="founder@acme.io",
        password="acme-demo",
        tenant_name="Acme Founder Tenant",
    ),
    DemoUser(
        id=UUID("00000000-0000-0000-0000-000000000002"),
        email="founder@nova.io",
        password="nova-demo",
        tenant_name="Nova Founder Tenant",
    ),
)


def list_demo_users() -> list[DemoUser]:
    return list(DEMO_USERS)


def authenticate_demo_user(email: str, password: str) -> DemoUser | None:
    normalized_email = email.strip().lower()
    for user in DEMO_USERS:
        if user.email.lower() == normalized_email and user.password == password:
            return user
    return None


def get_demo_user_by_id(user_id: UUID) -> DemoUser | None:
    for user in DEMO_USERS:
        if user.id == user_id:
            return user
    return None


def create_access_token(*, user: DemoUser) -> tuple[str, datetime]:
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.jwt_expiration_minutes)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "tenant_name": user.tenant_name,
        "exp": expires_at,
    }
    token = jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    return token, expires_at


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    subject = payload.get("sub")
    email = payload.get("email")
    if not isinstance(subject, str) or not isinstance(email, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    return payload
