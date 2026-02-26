"""Adaptive prior selection for the Bayesian stats engine.

Three sources of prior information, in priority order:
1. User-elicited: explicit expected rate + confidence from experiment config
2. Project historical: empirical Bayes from past experiment results
3. Platform default: Beta(1, 19) encoding ~5% conversion rate
"""

from __future__ import annotations

from typing import Optional

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.stats.bayesian import BetaBinomial


# ======================================================================
# User-elicited prior
# ======================================================================

def user_elicited_prior(expected_rate: float, confidence: float) -> BetaBinomial:
    """Build a BetaBinomial prior from user-specified expected rate and confidence.

    Parameters
    ----------
    expected_rate : float
        Expected conversion rate (0 < rate < 1).
    confidence : float
        Prior strength in pseudo-observations (1-100).
        Higher = more confident, tighter prior.

    Returns
    -------
    BetaBinomial
        Prior with alpha = rate * confidence, beta = (1-rate) * confidence.
    """
    if not (0 < expected_rate < 1):
        raise ValueError("expected_rate must be between 0 and 1 exclusive")
    if confidence <= 0:
        raise ValueError("confidence must be positive")

    alpha = expected_rate * confidence
    beta = (1 - expected_rate) * confidence
    return BetaBinomial(prior_alpha=max(alpha, 0.01), prior_beta=max(beta, 0.01))


# ======================================================================
# Project historical prior (empirical Bayes)
# ======================================================================

def fit_beta_moment_matching(rates: list[float]) -> tuple[float, float]:
    """Fit a Beta distribution to observed rates via moment matching.

    Given sample mean m and variance v:
        alpha = m * (m*(1-m)/v - 1)
        beta  = (1-m) * (m*(1-m)/v - 1)

    Parameters
    ----------
    rates : list[float]
        Observed conversion rates from past experiments.

    Returns
    -------
    tuple[float, float]
        (alpha, beta) parameters for the fitted Beta distribution.
    """
    if len(rates) < 2:
        raise ValueError("Need at least 2 rates for moment matching")

    arr = np.array(rates)
    m = float(np.mean(arr))
    v = float(np.var(arr, ddof=1))  # unbiased sample variance

    if m <= 0 or m >= 1:
        # Degenerate: fall back to platform default
        return (1.0, 19.0)

    if v <= 0 or v >= m * (1 - m):
        # Variance too small or too large for Beta; use weak prior at observed mean
        return (m * 5, (1 - m) * 5)

    common = m * (1 - m) / v - 1
    alpha = m * common
    beta = (1 - m) * common

    # Sanity bounds: floor at 0.1, cap at 1000 to prevent over-concentration
    alpha = min(max(alpha, 0.1), 1000.0)
    beta = min(max(beta, 0.1), 1000.0)

    return (alpha, beta)


async def project_historical_prior(
    db: AsyncSession,
    project_id,
    min_experiments: int = 3,
) -> Optional[BetaBinomial]:
    """Build a prior from past experiment results for this project.

    Uses moment matching on overall_conversion_rate from the
    experiment_results table.

    Parameters
    ----------
    db : AsyncSession
        Database session.
    project_id : UUID
        Project to query.
    min_experiments : int
        Minimum completed experiments needed.

    Returns
    -------
    BetaBinomial | None
        Fitted prior, or None if insufficient data.
    """
    from app.models.experiment_result import ExperimentResult

    result = await db.execute(
        select(ExperimentResult.overall_conversion_rate).where(
            ExperimentResult.project_id == project_id,
            ExperimentResult.overall_conversion_rate.isnot(None),
        )
    )
    rates = [row[0] for row in result.all() if row[0] is not None and 0 < row[0] < 1]

    if len(rates) < min_experiments:
        return None

    alpha, beta = fit_beta_moment_matching(rates)
    return BetaBinomial(prior_alpha=alpha, prior_beta=beta)


# ======================================================================
# Resolver (fallback chain)
# ======================================================================

async def resolve_prior(
    db: AsyncSession,
    project_id,
    expected_rate: Optional[float] = None,
    confidence: Optional[float] = None,
) -> tuple[BetaBinomial, str]:
    """Resolve the best available prior via fallback chain.

    Priority:
    1. User-elicited (if expected_rate and confidence provided)
    2. Project historical (from past experiment results)
    3. Platform default Beta(1, 19)

    Returns
    -------
    tuple[BetaBinomial, str]
        (prior, source) where source is "user_specified" | "project_historical" | "platform_default"
    """
    # 1. User-elicited
    if expected_rate is not None and confidence is not None:
        try:
            prior = user_elicited_prior(expected_rate, confidence)
            return (prior, "user_specified")
        except ValueError:
            pass  # Fall through on invalid values

    # 2. Project historical
    historical = await project_historical_prior(db, project_id)
    if historical is not None:
        return (historical, "project_historical")

    # 3. Platform default
    return (BetaBinomial(prior_alpha=1.0, prior_beta=19.0), "platform_default")
