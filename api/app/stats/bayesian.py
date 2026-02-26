"""Conjugate Beta-Binomial model for conversion rate estimation.

Uses an informative Beta(1, 19) prior encoding ~5% expected conversion rate,
which is appropriate for vibecoded apps with small sample sizes.  The model
is immutable: ``update()`` returns a *new* ``BetaBinomial`` so callers can
safely compare pre- and post-update posteriors.
"""

from __future__ import annotations

import numpy as np
from scipy import stats as sp_stats


def hdi_from_samples(samples: np.ndarray, credible_mass: float = 0.95) -> tuple[float, float]:
    """Compute the Highest Density Interval from Monte Carlo samples.

    Uses the sorted-interval method: find the shortest interval containing
    ``credible_mass`` proportion of sorted samples.

    Parameters
    ----------
    samples : np.ndarray
        1-D array of Monte Carlo samples.
    credible_mass : float
        Probability mass to include (e.g. 0.95 for 95% HDI).

    Returns
    -------
    tuple[float, float]
        (lower_bound, upper_bound)
    """
    sorted_samples = np.sort(samples)
    n = len(sorted_samples)
    interval_size = int(np.ceil(credible_mass * n))
    if interval_size >= n:
        return (float(sorted_samples[0]), float(sorted_samples[-1]))

    widths = sorted_samples[interval_size:] - sorted_samples[: n - interval_size]
    best_idx = int(np.argmin(widths))
    return (float(sorted_samples[best_idx]), float(sorted_samples[best_idx + interval_size - 1]))


class BetaBinomial:
    """Immutable Beta-Binomial conjugate model.

    Parameters
    ----------
    prior_alpha : float
        Alpha parameter of the Beta prior (pseudo-successes).  Default 1.
    prior_beta : float
        Beta parameter of the Beta prior (pseudo-failures).  Default 19,
        encoding an expected conversion rate of ~5%.
    """

    __slots__ = ("alpha", "beta")

    def __init__(self, prior_alpha: float = 1.0, prior_beta: float = 19.0) -> None:
        if prior_alpha <= 0 or prior_beta <= 0:
            raise ValueError("Alpha and beta must be positive")
        self.alpha = prior_alpha
        self.beta = prior_beta

    # ------------------------------------------------------------------
    # Posterior update (returns new instance — immutable)
    # ------------------------------------------------------------------

    def update(self, successes: int, trials: int) -> BetaBinomial:
        """Return a **new** BetaBinomial with the posterior after observing data.

        Parameters
        ----------
        successes : int
            Number of conversions observed.
        trials : int
            Total number of visitors/trials observed.

        Returns
        -------
        BetaBinomial
            New model with updated alpha and beta.
        """
        if successes < 0:
            raise ValueError("successes must be non-negative")
        if trials < 0:
            raise ValueError("trials must be non-negative")
        if successes > trials:
            raise ValueError("successes cannot exceed trials")
        return BetaBinomial(
            prior_alpha=self.alpha + successes,
            prior_beta=self.beta + (trials - successes),
        )

    # ------------------------------------------------------------------
    # Posterior summaries
    # ------------------------------------------------------------------

    def posterior_mean(self) -> float:
        """Expected value of the posterior Beta distribution: alpha / (alpha + beta)."""
        return self.alpha / (self.alpha + self.beta)

    def posterior_variance(self) -> float:
        """Variance of the posterior Beta distribution.

        Var = alpha * beta / ((alpha + beta)^2 * (alpha + beta + 1))
        """
        ab = self.alpha + self.beta
        return (self.alpha * self.beta) / (ab * ab * (ab + 1))

    def credible_interval(self, width: float = 0.95) -> tuple[float, float]:
        """Equal-tailed credible interval for the conversion rate.

        Parameters
        ----------
        width : float
            Width of the credible interval, e.g. 0.95 for 95%.

        Returns
        -------
        tuple[float, float]
            (lower_bound, upper_bound)
        """
        if not 0 < width < 1:
            raise ValueError("width must be between 0 and 1 exclusive")
        lower_tail = (1 - width) / 2
        dist = sp_stats.beta(self.alpha, self.beta)
        return (float(dist.ppf(lower_tail)), float(dist.ppf(1 - lower_tail)))

    # ------------------------------------------------------------------
    # HDI (Highest Density Interval)
    # ------------------------------------------------------------------

    def hdi(self, credible_mass: float = 0.95) -> tuple[float, float]:
        """Highest Density Interval for the posterior.

        Finds the narrowest interval containing ``credible_mass`` of the
        posterior probability.  Uses grid search over the CDF.

        Parameters
        ----------
        credible_mass : float
            Probability mass to include (e.g. 0.95 for 95% HDI).

        Returns
        -------
        tuple[float, float]
            (lower_bound, upper_bound)
        """
        from scipy.optimize import minimize_scalar

        dist = sp_stats.beta(self.alpha, self.beta)

        def interval_width(low_tail: float) -> float:
            return float(dist.ppf(low_tail + credible_mass) - dist.ppf(low_tail))

        result = minimize_scalar(
            interval_width,
            bounds=(0.0, 1.0 - credible_mass),
            method="bounded",
        )
        low = float(dist.ppf(result.x))
        high = float(dist.ppf(result.x + credible_mass))
        return (low, high)

    @staticmethod
    def difference_hdi(
        model_a: BetaBinomial,
        model_b: BetaBinomial,
        credible_mass: float = 0.95,
        n_samples: int = 50_000,
        seed: int = 42,
    ) -> tuple[float, float]:
        """HDI of (theta_B - theta_A) via Monte Carlo.

        Parameters
        ----------
        model_a, model_b : BetaBinomial
            The two posterior models.
        credible_mass : float
            Probability mass for the HDI.
        n_samples : int
            Number of MC samples.
        seed : int
            RNG seed.

        Returns
        -------
        tuple[float, float]
            (lower_bound, upper_bound) of the difference HDI.
        """
        rng = np.random.default_rng(seed)
        sa = rng.beta(model_a.alpha, model_a.beta, size=n_samples)
        sb = rng.beta(model_b.alpha, model_b.beta, size=n_samples)
        diff = sb - sa
        return hdi_from_samples(diff, credible_mass)

    # ------------------------------------------------------------------
    # Sampling and comparison
    # ------------------------------------------------------------------

    def sample(self, n: int, seed: int | None = None) -> np.ndarray:
        """Draw *n* samples from the posterior Beta distribution.

        Useful for Thompson Sampling and Monte Carlo comparisons.

        Parameters
        ----------
        n : int
            Number of samples to draw.
        seed : int | None
            Optional RNG seed for reproducibility.

        Returns
        -------
        np.ndarray
            Array of shape (n,) with samples in [0, 1].
        """
        rng = np.random.default_rng(seed)
        return rng.beta(self.alpha, self.beta, size=n)

    @staticmethod
    def probability_b_beats_a(
        model_a: BetaBinomial,
        model_b: BetaBinomial,
        n_samples: int = 50_000,
        seed: int = 42,
    ) -> float:
        """Monte Carlo estimate of P(conversion_rate_B > conversion_rate_A).

        Parameters
        ----------
        model_a : BetaBinomial
            The control / baseline model.
        model_b : BetaBinomial
            The challenger model.
        n_samples : int
            Number of Monte Carlo draws.
        seed : int
            RNG seed for reproducibility.

        Returns
        -------
        float
            Estimated probability that B's true rate exceeds A's.
        """
        rng = np.random.default_rng(seed)
        samples_a = rng.beta(model_a.alpha, model_a.beta, size=n_samples)
        samples_b = rng.beta(model_b.alpha, model_b.beta, size=n_samples)
        return float(np.mean(samples_b > samples_a))

    @staticmethod
    def probability_best(
        models: list[BetaBinomial],
        n_samples: int = 50_000,
        seed: int = 42,
    ) -> list[float]:
        """Monte Carlo estimate of P(variant_i is best) for each variant.

        Parameters
        ----------
        models : list[BetaBinomial]
            One model per variant.
        n_samples : int
            Number of Monte Carlo draws.
        seed : int
            RNG seed for reproducibility.

        Returns
        -------
        list[float]
            Probability of each variant being the best, sums to ~1.0.
        """
        samples = draw_sample_matrix(models, n_samples, seed)
        best_indices = np.argmax(samples, axis=1)
        counts = np.bincount(best_indices, minlength=len(models))
        return (counts / n_samples).tolist()

    # ------------------------------------------------------------------
    # Repr
    # ------------------------------------------------------------------

    def __repr__(self) -> str:
        return f"BetaBinomial(alpha={self.alpha:.3f}, beta={self.beta:.3f})"


# ======================================================================
# Shared utility
# ======================================================================

def draw_sample_matrix(
    models: list[BetaBinomial],
    n_samples: int,
    seed: int,
) -> np.ndarray:
    """Draw a (n_samples, n_variants) matrix from a list of BetaBinomial posteriors.

    Used by probability_best, ThompsonSampler, and expected_loss to avoid
    duplicating the sampling pattern.
    """
    rng = np.random.default_rng(seed)
    return np.column_stack(
        [rng.beta(m.alpha, m.beta, size=n_samples) for m in models]
    )
