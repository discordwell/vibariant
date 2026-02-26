"""Stats router — exposes experiment analysis results via the API.

Returns per-variant metrics, Bayesian comparisons, expected loss,
Thompson Sampling allocation, and plain-English recommendations.
"""

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


class EngagementComparison(BaseModel):
    means: dict[str, float] | None = None
    differences: dict[str, float] | None = None
    summary: str | None = None


class ExperimentResults(BaseModel):
    experiment_id: UUID
    experiment_key: str
    total_visitors: int
    variants: list[VariantResult]
    probability_b_beats_a: float | None = None
    probability_best: list[float] | None = None
    expected_loss: dict[str, float] | None = None
    recommendation: str | None = None
    suggested_allocation: dict[str, float] | None = None
    engagement_comparison: EngagementComparison | None = None


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.get(
    "/experiments/{experiment_id}/results",
    response_model=ExperimentResults,
)
async def get_experiment_results(
    experiment_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExperimentResults:
    """Get full statistical results for an experiment.

    Returns per-variant metrics (visitors, conversions, posterior mean,
    credible interval, engagement score), overall comparison metrics
    (probability best, expected loss, Thompson allocation), and a
    plain-English recommendation.
    """
    result = await db.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = result.scalar_one_or_none()
    if experiment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Experiment not found",
        )

    # Verify the current user owns the project
    await get_user_project(experiment.project_id, user, db)

    engine = StatsEngine(db)
    analysis = await engine.analyze_experiment(experiment)

    # Map engine output to response schema
    return ExperimentResults(**analysis)
