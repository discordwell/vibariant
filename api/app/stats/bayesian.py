import numpy as np
from scipy import stats as sp_stats


class BetaBinomial:
    """Conjugate Beta-Binomial model for conversion rate estimation.

    Uses a weakly informative Beta(1, 1) prior (uniform) by default.
    Suitable for small sample sizes typical of vibecoded apps.
    """

    def __init__(self, alpha_prior: float = 1.0, beta_prior: float = 1.0) -> None:
        self.alpha = alpha_prior
        self.beta = beta_prior

    def update(self, successes: int, trials: int) -> None:
        """Update posterior with observed data."""
        self.alpha += successes
        self.beta += trials - successes

    def posterior_mean(self) -> float:
        """Expected value of the posterior distribution."""
        return self.alpha / (self.alpha + self.beta)

    def credible_interval(self, confidence: float = 0.95) -> tuple[float, float]:
        """HDI credible interval for the conversion rate."""
        lower_tail = (1 - confidence) / 2
        dist = sp_stats.beta(self.alpha, self.beta)
        return (float(dist.ppf(lower_tail)), float(dist.ppf(1 - lower_tail)))

    @staticmethod
    def probability_b_beats_a(model_a: "BetaBinomial", model_b: "BetaBinomial", n_samples: int = 50_000) -> float:
        """Monte Carlo estimate of P(B > A)."""
        rng = np.random.default_rng(42)
        samples_a = rng.beta(model_a.alpha, model_a.beta, size=n_samples)
        samples_b = rng.beta(model_b.alpha, model_b.beta, size=n_samples)
        return float(np.mean(samples_b > samples_a))
