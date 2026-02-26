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


class TopTwoThompsonSampler:
    """Top-Two Thompson Sampling for increased exploration.

    On each round:
    1. Draw samples from all arms, find best (arm1).
    2. Draw again, find best *excluding* arm1 (arm2).
    3. With probability ``beta``, assign arm1; otherwise arm2.
    4. Enforce ``min_allocation`` floor so no arm drops below a minimum.

    This provides more exploration than standard Thompson Sampling,
    which is valuable for small-sample experiments.

    Parameters
    ----------
    models : list[BetaBinomial]
        One posterior model per variant.
    min_allocation : float
        Minimum allocation per arm (default 0.10 = 10%).
    beta : float
        Probability of choosing arm1 over arm2 (default 0.5).
    """

    def __init__(
        self,
        models: list[BetaBinomial],
        min_allocation: float = 0.10,
        beta: float = 0.5,
    ) -> None:
        if not models:
            raise ValueError("Must provide at least one model")
        self.models = models
        self.min_allocation = min_allocation
        self.beta = beta

    def select_variant(self, seed: int | None = None) -> int:
        """Select a variant using Top-Two Thompson Sampling."""
        rng = np.random.default_rng(seed)
        n = len(self.models)

        # First draw: find best arm
        draws1 = np.array([float(rng.beta(m.alpha, m.beta)) for m in self.models])
        arm1 = int(np.argmax(draws1))

        if n == 1:
            return arm1

        # Second draw: find best arm excluding arm1
        draws2 = np.array([float(rng.beta(m.alpha, m.beta)) for m in self.models])
        draws2[arm1] = -np.inf  # exclude arm1
        arm2 = int(np.argmax(draws2))

        # Choose arm1 with probability beta, arm2 otherwise
        if rng.random() < self.beta:
            return arm1
        return arm2

    def get_allocation(self, n_samples: int = 10_000, seed: int = 42) -> list[float]:
        """Estimate traffic allocation via Top-Two Thompson Sampling.

        Runs ``n_samples`` rounds and returns fractions, with a
        minimum allocation floor enforced.

        Parameters
        ----------
        n_samples : int
            Number of simulation rounds.
        seed : int
            RNG seed.

        Returns
        -------
        list[float]
            Allocation per variant, sums to 1.0.
        """
        n_variants = len(self.models)
        rng = np.random.default_rng(seed)
        counts = np.zeros(n_variants)

        for _ in range(n_samples):
            # First draw
            draws1 = np.array([float(rng.beta(m.alpha, m.beta)) for m in self.models])
            arm1 = int(np.argmax(draws1))

            if n_variants == 1:
                counts[arm1] += 1
                continue

            # Second draw (exclude arm1)
            draws2 = np.array([float(rng.beta(m.alpha, m.beta)) for m in self.models])
            draws2[arm1] = -np.inf
            arm2 = int(np.argmax(draws2))

            if rng.random() < self.beta:
                counts[arm1] += 1
            else:
                counts[arm2] += 1

        alloc = counts / n_samples

        # Enforce minimum allocation
        if n_variants > 1 and self.min_allocation > 0:
            floor = self.min_allocation
            below_floor = alloc < floor
            if np.any(below_floor) and not np.all(below_floor):
                # Redistribute from above-floor arms
                deficit = np.sum(np.maximum(floor - alloc, 0))
                above_floor = ~below_floor
                above_total = np.sum(alloc[above_floor])
                if above_total > deficit:
                    alloc[below_floor] = floor
                    # Proportionally reduce above-floor arms
                    scale = (above_total - deficit) / above_total
                    alloc[above_floor] *= scale

        # Normalize to sum to 1.0
        total = np.sum(alloc)
        if total > 0:
            alloc = alloc / total

        return alloc.tolist()
