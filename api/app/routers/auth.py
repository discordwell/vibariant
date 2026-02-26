from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, create_magic_link_token, verify_token
from app.models.project import Project
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class GitHubAuthRequest(BaseModel):
    code: str


class MagicLinkRequest(BaseModel):
    email: EmailStr


class VerifyRequest(BaseModel):
    token: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: UUID
    email: str


class MessageResponse(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# GitHub OAuth
# ---------------------------------------------------------------------------

@router.post("/github", response_model=AuthResponse)
async def github_auth(body: GitHubAuthRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    """Exchange a GitHub OAuth code for an access token."""
    # Exchange code for GitHub access token
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": body.code,
            },
            headers={"Accept": "application/json"},
        )
        token_data = token_resp.json()

    gh_access_token = token_data.get("access_token")
    if not gh_access_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to exchange GitHub code")

    # Fetch GitHub user profile
    async with httpx.AsyncClient() as client:
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {gh_access_token}", "Accept": "application/json"},
        )
        gh_user = user_resp.json()

    github_id = gh_user.get("id")
    email = gh_user.get("email") or f"{gh_user['login']}@users.noreply.github.com"
    name = gh_user.get("name") or gh_user.get("login")

    # Find or create user
    result = await db.execute(select(User).where(User.github_id == github_id))
    user = result.scalar_one_or_none()

    if user is None:
        # Check if email already exists (merge accounts)
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.github_id = github_id
            user.name = user.name or name
        else:
            user = User(email=email, github_id=github_id, name=name)
            db.add(user)
            await db.flush()
            # Auto-create a default project for new users
            project = Project(name="My Project", user_id=user.id)
            db.add(project)
        await db.flush()

    access_token = create_access_token(user.id)
    return AuthResponse(access_token=access_token, user_id=user.id, email=user.email)


# ---------------------------------------------------------------------------
# Magic Link
# ---------------------------------------------------------------------------

@router.post("/magic-link", response_model=MessageResponse)
async def send_magic_link(body: MagicLinkRequest, db: AsyncSession = Depends(get_db)) -> MessageResponse:
    """Generate a magic link token for passwordless login. In production, send this via email."""
    token = create_magic_link_token(body.email)
    # TODO: Send email with magic link containing the token
    # For now, log it (development convenience)
    print(f"[DEV] Magic link token for {body.email}: {token}")
    return MessageResponse(message="Magic link sent. Check your email.")


@router.post("/verify", response_model=AuthResponse)
async def verify_magic_link(body: VerifyRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    """Verify a magic link token and return an access token."""
    payload = verify_token(body.token, expected_type="magic")
    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid magic link token")

    # Find or create user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(email=email)
        db.add(user)
        await db.flush()
        # Auto-create a default project for new users
        project = Project(name="My Project", user_id=user.id)
        db.add(project)
        await db.flush()

    access_token = create_access_token(user.id)
    return AuthResponse(access_token=access_token, user_id=user.id, email=user.email)
