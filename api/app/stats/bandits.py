import numpy as np


class ThompsonSampler:
    """Thompson Sampling multi-armed bandit for dynamic traffic allocation.

    Each arm maintains a Beta posterior. On each sample, we draw from each
    arm's posterior and allocate traffic proportionally to win probability.
    """

    def __init__(self, variant_keys: list[str]) -> None:
        self.variant_keys = variant_keys
        # Beta(1, 1) uniform priors
        self.alphas = {k: 1.0 for k in variant_keys}
        self.betas = {k: 1.0 for k in variant_keys}

    def update(self, variant_key: str, successes: int, failures: int) -> None:
        """Update the posterior for a variant with observed outcomes."""
        self.alphas[variant_key] += successes
        self.betas[variant_key] += failures

    def sample(self, rng: np.random.Generator | None = None) -> str:
        """Draw from each arm's posterior and return the winning variant key."""
        rng = rng or np.random.default_rng()
        draws = {k: rng.beta(self.alphas[k], self.betas[k]) for k in self.variant_keys}
        return max(draws, key=draws.get)  # type: ignore[arg-type]

    def get_allocation(self, n_simulations: int = 10_000) -> dict[str, float]:
        """Compute traffic allocation proportions via repeated Thompson samples."""
        rng = np.random.default_rng(42)
        wins = {k: 0 for k in self.variant_keys}
        for _ in range(n_simulations):
            winner = self.sample(rng)
            wins[winner] += 1
        total = sum(wins.values())
        return {k: wins[k] / total for k in self.variant_keys}
