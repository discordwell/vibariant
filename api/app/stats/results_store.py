"""Persist completed experiment results for cross-experiment learning.

Called when an experiment transitions to 'completed' status to save
a snapshot of results into the experiment_results table.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.experiment import Experiment
from app.models.experiment_result import ExperimentResult


async def save_experiment_results(
    db: AsyncSession,
    experiment: Experiment,
    analysis: dict[str, Any],
) -> ExperimentResult:
    """Save experiment analysis results for future shrinkage/priors.

    Parameters
    ----------
    db : AsyncSession
        Database session.
    experiment : Experiment
        The completed experiment.
    analysis : dict
        Full analysis results from StatsEngine.

    Returns
    -------
    ExperimentResult
        The persisted result row.
    """
    variants = analysis.get("variants", [])

    # Compute overall conversion rate
    total_visitors = sum(v.get("visitors", 0) for v in variants)
    total_conversions = sum(v.get("conversions", 0) for v in variants)
    overall_rate = total_conversions / total_visitors if total_visitors > 0 else None

    # Determine winning variant
    winning_variant = None
    decision = analysis.get("decision")
    if decision and isinstance(decision, dict):
        winning_variant = decision.get("winning_variant")
    if not winning_variant and variants:
        # Fallback: highest posterior mean
        best = max(variants, key=lambda v: v.get("posterior_mean", 0))
        if best.get("posterior_mean", 0) > 0:
            winning_variant = best.get("variant_key")

    # Compute effect size (difference between best and worst posterior means)
    effect_size = None
    if len(variants) >= 2:
        means = [v.get("posterior_mean", 0) for v in variants]
        effect_size = max(means) - min(means)

    # Check for existing result (upsert)
    existing = await db.execute(
        select(ExperimentResult).where(
            ExperimentResult.experiment_id == experiment.id
        )
    )
    result_row = existing.scalar_one_or_none()

    if result_row:
        result_row.variant_results = {v.get("variant_key", f"v{i}"): v for i, v in enumerate(variants)}
        result_row.winning_variant = winning_variant
        result_row.overall_conversion_rate = overall_rate
        result_row.effect_size = effect_size
    else:
        result_row = ExperimentResult(
            id=uuid.uuid4(),
            experiment_id=experiment.id,
            project_id=experiment.project_id,
            variant_results={v.get("variant_key", f"v{i}"): v for i, v in enumerate(variants)},
            winning_variant=winning_variant,
            overall_conversion_rate=overall_rate,
            effect_size=effect_size,
        )
        db.add(result_row)

    await db.flush()
    return result_row
