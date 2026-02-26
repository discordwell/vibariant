"""Expected-loss computation and plain-English recommendation generation.

Expected loss is the Bayesian answer to "how much am I leaving on the table
if I pick the wrong variant?"  Combined with probability-of-being-best, it
drives the recommendation engine that gives vibecoders actionable guidance
even with tiny sample sizes.
"""

from __future__ import annotations

import numpy as np

from app.stats.bayesian import BetaBinomial, draw_sample_matrix


# ======================================================================
# Expected loss
# ======================================================================

def expected_loss(
    models: list[BetaBinomial],
    n_samples: int = 50_000,
    seed: int = 137,
) -> list[float]:
    """Compute the expected loss for each variant.

    For variant *i*, expected loss is defined as::

        E[ max_j(theta_j) - theta_i ]

    i.e. the expected regret of choosing variant *i* when a better one
    may exist.  A lower value means less risk in committing to that
    variant.

    Parameters
    ----------
    models : list[BetaBinomial]
        One posterior per variant.
    n_samples : int
        Monte Carlo draws.
    seed : int
        RNG seed for reproducibility.

    Returns
    -------
    list[float]
        Expected loss for each variant.
    """
    # Matrix of shape (n_samples, n_variants)
    samples = draw_sample_matrix(models, n_samples, seed)
    best_per_row = np.max(samples, axis=1, keepdims=True)  # (n_samples, 1)
    losses = best_per_row - samples  # (n_samples, n_variants)
    return np.mean(losses, axis=0).tolist()


# ======================================================================
# Recommendation generation
# ======================================================================

def generate_recommendation(analysis: dict) -> str:
    """Generate a plain-English recommendation from the analysis dict.

    The ``analysis`` dict is expected to contain:

    - ``variants``: list of per-variant dicts with ``visitors``,
      ``conversions``, ``variant_key``
    - ``probability_best``: list of P(variant_i is best) (optional)
    - ``probability_b_beats_a``: float (optional, 2-variant case)
    - ``expected_loss``: list of floats per variant (optional)
    - ``engagement_comparison``: dict with ``summary`` key (optional)

    Returns
    -------
    str
        Markdown-formatted recommendation string.
    """
    variants = analysis.get("variants", [])
    total_visitors = sum(v.get("visitors", 0) for v in variants)
    total_conversions = sum(v.get("conversions", 0) for v in variants)

    # ---- Very early: fewer than 10 total visitors ----
    if total_visitors < 10:
        return (
            f"**Just getting started.** Only {total_visitors} "
            f"visitor{'s' if total_visitors != 1 else ''} so far. "
            "Need more data for any meaningful comparison."
        )

    # ---- No conversions but we may have engagement data ----
    if total_conversions == 0:
        engagement = analysis.get("engagement_comparison")
        if engagement and engagement.get("summary"):
            return (
                "**Not enough conversions yet**, but engagement data is available. "
                + engagement["summary"]
                + " This usually predicts better conversion."
            )
        return (
            f"**Too early to tell.** After {total_visitors} visitors, "
            "no conversions have been recorded. Keep testing."
        )

    # ---- Determine best variant using probability_best or prob_b_beats_a ----
    prob_best = analysis.get("probability_best")
    exp_loss = analysis.get("expected_loss")

    # For 2-variant shortcut
    prob_b_beats_a = analysis.get("probability_b_beats_a")

    if prob_best is not None and len(prob_best) == len(variants):
        best_idx = int(np.argmax(prob_best))
        best_prob = prob_best[best_idx]
        best_variant = variants[best_idx]
    elif prob_b_beats_a is not None and len(variants) == 2:
        # Convert to per-variant probabilities
        if prob_b_beats_a > 0.5:
            best_idx = 1
            best_prob = prob_b_beats_a
        else:
            best_idx = 0
            best_prob = 1 - prob_b_beats_a
        best_variant = variants[best_idx]
    else:
        return (
            f"**Too early to tell.** After {total_visitors} visitors, "
            "the variants look similar. Keep testing."
        )

    best_key = best_variant.get("variant_key", f"#{best_idx}")
    best_prob_pct = best_prob * 100

    # Compute gain from expected loss if available
    gain_str = ""
    if exp_loss is not None and len(exp_loss) == len(variants):
        # The gain of picking the best vs the worst expected loss
        best_loss = exp_loss[best_idx]
        worst_loss = max(exp_loss)
        gain = worst_loss - best_loss
        if gain > 0.0001:
            gain_str = f" Expected gain: +{gain * 100:.1f}% conversion rate."

    # ---- Sparse conversions: only 1-2 total conversions ----
    if total_conversions <= 2:
        engagement = analysis.get("engagement_comparison")
        if engagement and engagement.get("summary"):
            engagement_insight = engagement["summary"]
            return (
                f"**Not enough conversions yet**, but Variant {best_key} "
                f"visitors {engagement_insight.lower()} "
                "This usually predicts better conversion."
            )
        return (
            f"**Too early to tell.** After {total_visitors} visitors, "
            "the variants look similar. Keep testing."
        )

    # ---- High confidence winner ----
    if best_prob >= 0.90:
        return (
            f"**Variant {best_key} is winning.** "
            f"{best_prob_pct:.0f}% chance it converts better.{gain_str} "
            "We recommend switching."
        )

    # ---- Moderate confidence ----
    if best_prob >= 0.75:
        return (
            f"**Variant {best_key} is likely better** "
            f"({best_prob_pct:.0f}% probability).{gain_str} "
            "Keep running for more confidence before committing."
        )

    # ---- Too close to call ----
    return (
        f"**Too early to tell.** After {total_visitors} visitors, "
        "the variants look similar. Keep testing."
    )
