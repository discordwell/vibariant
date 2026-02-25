from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_user_project
from app.core.security import get_current_user
from app.models.experiment import Experiment
from app.models.user import User
from app.stats.engine import StatsEngine

router = APIRouter(tags=["stats"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class VariantResult(BaseModel):
    variant_key: str
    visitors: int
    conversions: int
    conversion_rate: float
    posterior_mean: float
    credible_interval: tuple[float, float]
    engagement_score: float | None = None


class ExperimentResults(BaseModel):
    experiment_id: UUID
    experiment_key: str
    total_visitors: int
    variants: list[VariantResult]
    probability_b_beats_a: float | None = None
    expected_loss: float | None = None
    recommendation: str | None = None


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("/experiments/{experiment_id}/results", response_model=ExperimentResults)
async def get_experiment_results(
    experiment_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExperimentResults:
    """Get statistical results for an experiment."""
    result = await db.execute(select(Experiment).where(Experiment.id == experiment_id))
    experiment = result.scalar_one_or_none()
    if experiment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found")

    # Verify ownership
    await get_user_project(experiment.project_id, user, db)

    engine = StatsEngine(db)
    return await engine.analyze_experiment(experiment)
