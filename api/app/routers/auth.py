import secrets
import time
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, create_magic_link_token, get_current_user, verify_token
from app.models.project import Project
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

# In-memory store for CLI device-code auth flow.
# Maps device_code -> {email, magic_token, created_at, access_token?, user_id?, user_email?, status}
# NOTE: This is process-local — won't work with multiple uvicorn workers or load balancers.
# For multi-worker production, swap to Redis or DB-backed storage.
_cli_pending_auths: dict[str, dict] = {}
_CLI_AUTH_TTL_SECONDS = 300  # 5 minutes


def _cleanup_expired_auths() -> None:
    """Remove expired entries from the pending auth store."""
    now = time.time()
    expired = [k for k, v in _cli_pending_auths.items() if now - v["created_at"] > _CLI_AUTH_TTL_SECONDS]
    for k in expired:
        del _cli_pending_auths[k]


def _is_dev_mode() -> bool:
    """Check if running in dev mode by detecting default secret keys."""
    return settings.SECRET_KEY in ("change-me-in-production", "dev-secret-change-in-production")


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


class UserInfoResponse(BaseModel):
    user_id: UUID
    email: str
    name: str | None = None


class CLILoginRequest(BaseModel):
    email: EmailStr


class CLILoginResponse(BaseModel):
    device_code: str
    expires_in: int = _CLI_AUTH_TTL_SECONDS
    poll_interval: int = 2
    dev_token: str | None = None


class CLIPollRequest(BaseModel):
    device_code: str


class CLIPollResponse(BaseModel):
    status: str  # "pending" | "authorized" | "expired"
    access_token: str | None = None
    user_id: UUID | None = None
    email: str | None = None


class CLICompleteRequest(BaseModel):
    device_code: str
    token: str


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


# ---------------------------------------------------------------------------
# Current User
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserInfoResponse)
async def get_me(user: User = Depends(get_current_user)) -> UserInfoResponse:
    """Return info about the currently authenticated user."""
    return UserInfoResponse(user_id=user.id, email=user.email, name=user.name)


# ---------------------------------------------------------------------------
# CLI Device-Code Auth
# ---------------------------------------------------------------------------

@router.post("/cli-login", response_model=CLILoginResponse)
async def cli_login(body: CLILoginRequest) -> CLILoginResponse:
    """Start a CLI auth session. Returns a device_code the CLI polls.

    In dev mode (default SECRET_KEY), also returns a dev_token for instant auth.
    """
    _cleanup_expired_auths()

    device_code = secrets.token_urlsafe(32)
    magic_token = create_magic_link_token(body.email)

    _cli_pending_auths[device_code] = {
        "email": body.email,
        "magic_token": magic_token,
        "created_at": time.time(),
        "status": "pending",
    }

    dev_token = magic_token if _is_dev_mode() else None

    return CLILoginResponse(device_code=device_code, dev_token=dev_token)


@router.post("/cli-poll", response_model=CLIPollResponse)
async def cli_poll(body: CLIPollRequest) -> CLIPollResponse:
    """Poll for CLI auth completion. Returns authorized + access_token when the user verifies."""
    _cleanup_expired_auths()

    entry = _cli_pending_auths.get(body.device_code)
    if entry is None:
        return CLIPollResponse(status="expired")

    if entry["status"] == "authorized":
        # Clean up after successful retrieval
        result = CLIPollResponse(
            status="authorized",
            access_token=entry["access_token"],
            user_id=entry["user_id"],
            email=entry["user_email"],
        )
        del _cli_pending_auths[body.device_code]
        return result

    return CLIPollResponse(status="pending")


@router.post("/cli-complete", response_model=MessageResponse)
async def cli_complete(body: CLICompleteRequest, db: AsyncSession = Depends(get_db)) -> MessageResponse:
    """Complete CLI auth by verifying the magic link token. Called from dashboard or directly."""
    _cleanup_expired_auths()

    entry = _cli_pending_auths.get(body.device_code)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device code expired or not found")

    # Verify the magic link token
    payload = verify_token(body.token, expected_type="magic")
    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid magic link token")

    # Verify token email matches device code email
    if email != entry["email"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email mismatch")

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

    # Mark the device code as authorized
    entry["status"] = "authorized"
    entry["access_token"] = access_token
    entry["user_id"] = user.id
    entry["user_email"] = user.email

    return MessageResponse(message="CLI authenticated successfully.")
