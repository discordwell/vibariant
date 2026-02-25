from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_user_project
from app.core.security import get_current_user, verify_project_token
from app.models.goal import Goal
from app.models.user import User

router = APIRouter(tags=["goals"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class GoalCreate(BaseModel):
    type: str
    label: str
    trigger: dict | None = None
    confidence: float | None = None


class GoalUpdate(BaseModel):
    label: str | None = None
    confirmed: bool | None = None
    trigger: dict | None = None


class GoalOut(BaseModel):
    id: UUID
    project_id: UUID
    type: str
    label: str
    trigger: dict | None
    confidence: float | None
    confirmed: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/goals", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
async def create_goal(
    body: GoalCreate,
    x_project_token: str = Header(..., alias="X-Project-Token"),
    db: AsyncSession = Depends(get_db),
) -> GoalOut:
    """Receive a detected goal from the SDK."""
    project = await verify_project_token(x_project_token, db)
    goal = Goal(
        project_id=project.id,
        type=body.type,
        label=body.label,
        trigger=body.trigger,
        confidence=body.confidence,
    )
    db.add(goal)
    await db.flush()
    await db.refresh(goal)
    return goal


@router.get("/goals", response_model=list[GoalOut])
async def list_goals(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GoalOut]:
    """List goals for a project (dashboard use)."""
    await get_user_project(project_id, user, db)

    result = await db.execute(select(Goal).where(Goal.project_id == project_id))
    return result.scalars().all()


@router.patch("/goals/{goal_id}", response_model=GoalOut)
async def update_goal(
    goal_id: UUID,
    body: GoalUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GoalOut:
    """Confirm or edit a detected goal."""
    result = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")

    # Verify ownership via project
    await get_user_project(goal.project_id, user, db)

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(goal, field, value)
    await db.flush()
    await db.refresh(goal)
    return goal
