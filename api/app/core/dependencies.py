from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.user import User


async def get_user_project(project_id: UUID, user: User, db: AsyncSession) -> Project:
    """Verify a project exists and belongs to the given user.

    Raises HTTP 404 if the project is not found or does not belong to the user.
    """
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project
