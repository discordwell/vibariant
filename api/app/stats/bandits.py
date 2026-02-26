"""Thompson Sampling multi-armed bandit for dynamic traffic allocation.

Each arm is represented by a ``BetaBinomial`` posterior.  On each round
Thompson Sampling draws a sample from every arm and picks the highest.
Repeated over many rounds this naturally produces traffic allocations
that balance exploration and exploitation.
"""

from __future__ import annotations

import numpy as np

from app.stats.bayesian import BetaBinomial, draw_sample_matrix


class ThompsonSampler:
    """Thompson Sampling bandit backed by BetaBinomial posteriors.

    Parameters
    ----------
    models : list[BetaBinomial]
        One posterior model per variant, in variant-index order.
    """

    def __init__(self, models: list[BetaBinomial]) -> None:
        if not models:
            raise ValueError("Must provide at least one model")
        self.models = models

    # ------------------------------------------------------------------
    # Single-draw helpers
    # ------------------------------------------------------------------

    def sample_best(self, seed: int | None = None) -> int:
        """Draw one sample from each arm's posterior; return index of the highest.

        Parameters
        ----------
        seed : int | None
            Optional RNG seed for reproducibility.

        Returns
        -------
        int
            Index of the winning variant.
        """
        rng = np.random.default_rng(seed)
        draws = [float(rng.beta(m.alpha, m.beta)) for m in self.models]
        return int(np.argmax(draws))

    def select_variant(self, seed: int | None = None) -> int:
        """Alias for ``sample_best`` -- select a single variant via Thompson Sampling.

        This is the method to call in the hot path when assigning a new
        visitor to a variant.

        Returns
        -------
        int
            Index of the selected variant.
        """
        return self.sample_best(seed=seed)

    # ------------------------------------------------------------------
    # Allocation estimation
    # ------------------------------------------------------------------

    def get_allocation(self, n_samples: int = 10_000, seed: int = 42) -> list[float]:
        """Estimate optimal traffic allocation via repeated Thompson draws.

        Runs ``n_samples`` independent rounds of Thompson Sampling and
        returns the fraction of times each variant wins.  This gives a
        natural traffic-split recommendation that balances exploration
        and exploitation.

        Parameters
        ----------
        n_samples : int
            Number of simulation rounds.
        seed : int
            RNG seed for reproducibility.

        Returns
        -------
        list[float]
            Allocation fraction per variant, sums to ~1.0.
        """
        n_variants = len(self.models)

        # Vectorised: draw (n_samples, n_variants) matrix in one go
        samples = draw_sample_matrix(self.models, n_samples, seed)
        winners = np.argmax(samples, axis=1)
        counts = np.bincount(winners, minlength=n_variants)
        return (counts / n_samples).tolist()
