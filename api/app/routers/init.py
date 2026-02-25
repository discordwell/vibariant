from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import verify_project_token
from app.models.experiment import Experiment, ExperimentStatus
from app.models.visitor import Visitor
from app.services.assignment import assign_variant

router = APIRouter(tags=["sdk"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class InitRequest(BaseModel):
    visitor_id: str
    session_id: str | None = None
    attributes: dict | None = None


class ExperimentAssignment(BaseModel):
    experiment_key: str
    variant: str


class InitResponse(BaseModel):
    visitor_id: str
    assignments: list[ExperimentAssignment]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/init", response_model=InitResponse)
async def sdk_init(
    body: InitRequest,
    x_project_token: str = Header(..., alias="X-Project-Token"),
    db: AsyncSession = Depends(get_db),
) -> InitResponse:
    """SDK initialization: register visitor, return variant assignments for all running experiments."""
    project = await verify_project_token(x_project_token, db)

    # Upsert visitor
    result = await db.execute(
        select(Visitor).where(Visitor.project_id == project.id, Visitor.visitor_id == body.visitor_id)
    )
    visitor = result.scalar_one_or_none()
    if visitor is None:
        visitor = Visitor(
            project_id=project.id,
            visitor_id=body.visitor_id,
            attributes=body.attributes,
        )
        db.add(visitor)
    else:
        if body.attributes:
            visitor.attributes = {**(visitor.attributes or {}), **body.attributes}
        from sqlalchemy import func

        visitor.last_seen = func.now()
    await db.flush()

    # Get running experiments and compute assignments
    result = await db.execute(
        select(Experiment).where(
            Experiment.project_id == project.id,
            Experiment.status == ExperimentStatus.running,
        )
    )
    experiments = result.scalars().all()

    assignments: list[ExperimentAssignment] = []
    for exp in experiments:
        variant = assign_variant(
            visitor_id=body.visitor_id,
            experiment_key=exp.key,
            variant_keys=exp.variant_keys,
            traffic_percentage=exp.traffic_percentage,
        )
        if variant is not None:
            assignments.append(ExperimentAssignment(experiment_key=exp.key, variant=variant))

    return InitResponse(visitor_id=body.visitor_id, assignments=assignments)
