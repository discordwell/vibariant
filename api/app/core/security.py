import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db

ALGORITHM = "HS256"
bearer_scheme = HTTPBearer()


def create_access_token(user_id: UUID, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(UTC) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    payload = {"sub": str(user_id), "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_magic_link_token(email: str) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.MAGIC_LINK_EXPIRE_MINUTES)
    payload = {"sub": email, "exp": expire, "type": "magic"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str, expected_type: str = "access") -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != expected_type:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def generate_project_token() -> str:
    return f"vv_proj_{secrets.token_urlsafe(24)}"


def generate_api_key() -> str:
    return f"vv_sk_{secrets.token_urlsafe(32)}"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Dependency: extract and validate the current user from the JWT bearer token."""
    from app.models.user import User

    payload = verify_token(credentials.credentials, expected_type="access")
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def verify_api_key(api_key: str, db: AsyncSession) -> "Project":  # noqa: F821
    """Verify a project API key and return the associated project."""
    from app.models.project import Project

    result = await db.execute(select(Project).where(Project.api_key == api_key))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    return project


async def verify_project_token(project_token: str, db: AsyncSession) -> "Project":  # noqa: F821
    """Verify a public project token and return the associated project."""
    from app.models.project import Project

    result = await db.execute(select(Project).where(Project.project_token == project_token))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid project token")
    return project
