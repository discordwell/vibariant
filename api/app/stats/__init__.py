"""VibeVariant Bayesian statistics engine.

Public API:
- BetaBinomial: Conjugate Beta-Binomial model for conversion rate estimation
- ThompsonSampler: Multi-armed bandit for traffic allocation
- ProxyMetrics: Engagement proxy metrics for sparse conversion data
- expected_loss: Bayesian expected loss computation
- generate_recommendation: Plain-English recommendation generator
- StatsEngine: Async orchestrator that ties everything together
"""

from app.stats.bandits import ThompsonSampler
from app.stats.bayesian import BetaBinomial
from app.stats.decisions import expected_loss, generate_recommendation
from app.stats.engine import StatsEngine
from app.stats.proxy import ProxyMetrics

__all__ = [
    "BetaBinomial",
    "ThompsonSampler",
    "ProxyMetrics",
    "expected_loss",
    "generate_recommendation",
    "StatsEngine",
]
