import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_user_project
from app.core.security import get_current_user
from app.models.experiment import Experiment, ExperimentStatus
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["experiments"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ExperimentCreate(BaseModel):
    project_id: UUID
    key: str
    name: str
    variant_keys: list[str] = ["control", "variant"]
    traffic_percentage: float = 1.0
    # v2 stats config
    loss_threshold: float = 0.005
    rope_width: float = 0.005
    expected_conversion_rate: float | None = None
    prior_confidence: float | None = None


class ExperimentUpdate(BaseModel):
    name: str | None = None
    status: ExperimentStatus | None = None
    variant_keys: list[str] | None = None
    traffic_percentage: float | None = None
    # v2 stats config
    loss_threshold: float | None = None
    rope_width: float | None = None
    expected_conversion_rate: float | None = None
    prior_confidence: float | None = None


class ExperimentOut(BaseModel):
    id: UUID
    project_id: UUID
    key: str
    name: str
    status: ExperimentStatus
    variant_keys: list[str]
    traffic_percentage: float
    # v2 stats config
    loss_threshold: float = 0.005
    rope_width: float = 0.005
    expected_conversion_rate: float | None = None
    prior_confidence: float | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_experiment(experiment_id: UUID, user: User, db: AsyncSession) -> Experiment:
    result = await db.execute(select(Experiment).where(Experiment.id == experiment_id))
    experiment = result.scalar_one_or_none()
    if experiment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found")
    # Verify ownership
    await get_user_project(experiment.project_id, user, db)
    return experiment


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/experiments", response_model=list[ExperimentOut])
async def list_experiments(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ExperimentOut]:
    """List all experiments for a project."""
    await get_user_project(project_id, user, db)
    result = await db.execute(select(Experiment).where(Experiment.project_id == project_id))
    return result.scalars().all()


@router.post("/experiments", response_model=ExperimentOut, status_code=status.HTTP_201_CREATED)
async def create_experiment(
    body: ExperimentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExperimentOut:
    """Create a new experiment."""
    await get_user_project(body.project_id, user, db)
    experiment = Experiment(
        project_id=body.project_id,
        key=body.key,
        name=body.name,
        variant_keys=body.variant_keys,
        traffic_percentage=body.traffic_percentage,
        loss_threshold=body.loss_threshold,
        rope_width=body.rope_width,
        expected_conversion_rate=body.expected_conversion_rate,
        prior_confidence=body.prior_confidence,
    )
    db.add(experiment)
    await db.flush()
    await db.refresh(experiment)
    return experiment


@router.get("/experiments/{experiment_id}", response_model=ExperimentOut)
async def get_experiment(
    experiment_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExperimentOut:
    """Get a single experiment by ID."""
    return await _get_experiment(experiment_id, user, db)


@router.patch("/experiments/{experiment_id}", response_model=ExperimentOut)
async def update_experiment(
    experiment_id: UUID,
    body: ExperimentUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExperimentOut:
    """Update an experiment."""
    experiment = await _get_experiment(experiment_id, user, db)
    old_status = experiment.status
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(experiment, field, value)
    await db.flush()
    await db.refresh(experiment)

    # On completion, save results snapshot for future shrinkage/priors
    new_status = update_data.get("status")
    if new_status == ExperimentStatus.completed and old_status != ExperimentStatus.completed:
        try:
            from app.stats.engine import StatsEngine
            from app.stats.results_store import save_experiment_results

            engine = StatsEngine(db)
            analysis = await engine.analyze_experiment(experiment)
            await save_experiment_results(db, experiment, analysis)
            await db.flush()
        except Exception:
            logger.exception("Failed to save experiment results on completion for %s", experiment_id)

    return experiment


@router.delete("/experiments/{experiment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_experiment(
    experiment_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete an experiment."""
    experiment = await _get_experiment(experiment_id, user, db)
    await db.delete(experiment)
    await db.flush()
