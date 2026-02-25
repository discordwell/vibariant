import numpy as np

from app.stats.bayesian import BetaBinomial


def expected_loss(model_a: BetaBinomial, model_b: BetaBinomial, n_samples: int = 50_000) -> float:
    """Compute the expected loss of choosing B over A.

    Expected loss = E[max(theta_A - theta_B, 0)]
    A lower value means less risk in choosing B.
    """
    rng = np.random.default_rng(137)
    samples_a = rng.beta(model_a.alpha, model_a.beta, size=n_samples)
    samples_b = rng.beta(model_b.alpha, model_b.beta, size=n_samples)
    loss = np.maximum(samples_a - samples_b, 0)
    return float(np.mean(loss))


def generate_recommendation(
    prob_b_beats_a: float,
    expected_loss: float,
    visitors_a: int,
    visitors_b: int,
    loss_threshold: float = 0.005,
) -> str:
    """Generate a plain-English recommendation for the experiment.

    Uses probability of improvement and expected loss to give
    actionable guidance even with small sample sizes.
    """
    total = visitors_a + visitors_b

    if total < 10:
        return "Too early to tell. Keep the experiment running to collect more data."

    if total < 30:
        if prob_b_beats_a > 0.8:
            return (
                "Early signal: Variant B looks promising with "
                f"{prob_b_beats_a:.0%} probability of being better. "
                "But sample size is small -- keep running."
            )
        elif prob_b_beats_a < 0.2:
            return (
                "Early signal: Control appears better with "
                f"{1 - prob_b_beats_a:.0%} probability. "
                "But sample size is small -- keep running."
            )
        return "Not enough data yet. Keep running the experiment."

    # Sufficient data for a recommendation
    if expected_loss < loss_threshold and prob_b_beats_a > 0.9:
        return (
            f"Strong evidence for Variant B ({prob_b_beats_a:.0%} probability of being better, "
            f"expected loss {expected_loss:.3f}). Safe to ship Variant B."
        )

    if expected_loss < loss_threshold and prob_b_beats_a < 0.1:
        return (
            f"Strong evidence for Control ({1 - prob_b_beats_a:.0%} probability of being better). "
            "Consider reverting to control."
        )

    if prob_b_beats_a > 0.7:
        return (
            f"Variant B is likely better ({prob_b_beats_a:.0%} probability) "
            f"but expected loss is {expected_loss:.3f}. Keep running for more confidence."
        )

    if prob_b_beats_a < 0.3:
        return (
            f"Control is likely better ({1 - prob_b_beats_a:.0%} probability). "
            "Consider stopping the experiment or trying a different variant."
        )

    return (
        f"Results are inconclusive ({prob_b_beats_a:.0%} chance B is better). "
        "Keep running or consider a bigger change between variants."
    )
