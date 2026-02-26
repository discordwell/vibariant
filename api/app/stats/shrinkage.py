"""James-Stein shrinkage for cross-experiment effect size estimation.

When a project has accumulated multiple completed experiments, raw effect
sizes suffer from winner's curse (overestimation). James-Stein shrinkage
pulls extreme estimates toward the grand mean, giving more accurate
predictions of future performance.
"""

from __future__ import annotations

from typing import Optional

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def james_stein_shrink(
    observed_effects: list[float],
    standard_errors: list[float],
) -> list[float]:
    """Apply James-Stein shrinkage to a set of observed effect sizes.

    Shrinks toward the grand mean. The shrinkage factor is:
        B = max(0, 1 - (n-2) * mean(se^2) / sum((effects - grand_mean)^2))

    Parameters
    ----------
    observed_effects : list[float]
        Raw effect sizes from multiple experiments.
    standard_errors : list[float]
        Standard errors corresponding to each effect.

    Returns
    -------
    list[float]
        Shrunk effect sizes.
    """
    n = len(observed_effects)
    if n < 3:
        return list(observed_effects)

    effects = np.array(observed_effects)
    ses = np.array(standard_errors)
    grand_mean = float(np.mean(effects))

    mean_se_sq = float(np.mean(ses ** 2))
    ss_effects = float(np.sum((effects - grand_mean) ** 2))

    if ss_effects < 1e-10:
        return list(observed_effects)

    shrinkage_factor = max(0.0, 1.0 - (n - 2) * mean_se_sq / ss_effects)
    shrunk = grand_mean + shrinkage_factor * (effects - grand_mean)
    return shrunk.tolist()


async def shrink_current_effect(
    db: AsyncSession,
    project_id,
    current_effect: float,
    current_se: float,
) -> Optional[float]:
    """Shrink the current experiment's effect size using project history.

    Fetches past experiment effect sizes from experiment_results,
    appends the current one, applies James-Stein, and returns the
    shrunk estimate for the current experiment.

    Parameters
    ----------
    db : AsyncSession
        Database session.
    project_id : UUID
        Project to query.
    current_effect : float
        Raw effect size of the current experiment.
    current_se : float
        Standard error of the current effect.

    Returns
    -------
    float | None
        Shrunk effect size, or None if insufficient history (<3 total).
    """
    from app.models.experiment_result import ExperimentResult

    result = await db.execute(
        select(
            ExperimentResult.effect_size,
        ).where(
            ExperimentResult.project_id == project_id,
            ExperimentResult.effect_size.isnot(None),
        )
    )
    rows = result.all()
    past_effects = [row[0] for row in rows if row[0] is not None]

    # Need at least 2 past + 1 current = 3 total
    all_effects = past_effects + [current_effect]
    if len(all_effects) < 3:
        return None

    # Estimate standard errors for past experiments (use median of available)
    # For simplicity, assume similar SE as current for historical experiments
    all_ses = [current_se] * len(past_effects) + [current_se]

    shrunk = james_stein_shrink(all_effects, all_ses)
    return shrunk[-1]  # Last element is the current experiment
