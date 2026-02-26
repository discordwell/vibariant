"""VibeVariant Bayesian statistics engine.

Public API:
- BetaBinomial: Conjugate Beta-Binomial model for conversion rate estimation
- ThompsonSampler: Multi-armed bandit for traffic allocation
- TopTwoThompsonSampler: Enhanced Thompson Sampling with more exploration
- ProxyMetrics: Engagement proxy metrics for sparse conversion data
- expected_loss: Bayesian expected loss computation
- generate_recommendation: Structured recommendation generator
- StatsEngine: Async orchestrator that ties everything together
"""

from app.stats.bandits import ThompsonSampler, TopTwoThompsonSampler
from app.stats.bayesian import BetaBinomial, hdi_from_samples
from app.stats.decisions import expected_loss, generate_recommendation
from app.stats.engine import StatsEngine
from app.stats.priors import resolve_prior, user_elicited_prior
from app.stats.proxy import ProxyMetrics
from app.stats.shrinkage import james_stein_shrink

__all__ = [
    "BetaBinomial",
    "hdi_from_samples",
    "ThompsonSampler",
    "TopTwoThompsonSampler",
    "ProxyMetrics",
    "expected_loss",
    "generate_recommendation",
    "StatsEngine",
    "resolve_prior",
    "user_elicited_prior",
    "james_stein_shrink",
]
