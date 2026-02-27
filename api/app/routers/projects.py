from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.project import Project
from app.models.user import User

router = APIRouter(tags=["projects"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ProjectOut(BaseModel):
    id: UUID
    name: str
    project_token: str
    api_key: str

    model_config = {"from_attributes": True}


class ProjectCreate(BaseModel):
    name: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/projects", response_model=list[ProjectOut])
async def list_projects(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectOut]:
    """List all projects for the authenticated user."""
    result = await db.execute(select(Project).where(Project.user_id == user.id))
    return result.scalars().all()


@router.post("/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectOut:
    """Create a new project for the authenticated user."""
    project = Project(name=body.name, user_id=user.id)
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return project
