"""Expected-loss computation, ROPE decision rules, and recommendation generation.

Expected loss is the Bayesian answer to "how much am I leaving on the table
if I pick the wrong variant?"  Combined with probability-of-being-best and
ROPE (Region of Practical Equivalence), it drives the recommendation engine
that gives vibecoders actionable guidance even with tiny sample sizes.
"""

from __future__ import annotations

import numpy as np

from app.stats.bayesian import BetaBinomial, draw_sample_matrix, hdi_from_samples


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
# ROPE (Region of Practical Equivalence) decisions
# ======================================================================

def rope_decision(
    model_a: BetaBinomial,
    model_b: BetaBinomial,
    rope_width: float = 0.005,
    n_samples: int = 50_000,
    seed: int = 42,
) -> dict:
    """ROPE-based decision between two variants.

    Computes the 95% HDI of (theta_B - theta_A) and checks its
    relationship to the ROPE [-rope_width, +rope_width].

    Parameters
    ----------
    model_a, model_b : BetaBinomial
        Posterior models for the two variants.
    rope_width : float
        Half-width of the ROPE region.
    n_samples : int
        Monte Carlo draws.
    seed : int
        RNG seed.

    Returns
    -------
    dict
        decision: "ship_a" | "ship_b" | "equivalent" | "undecided"
        hdi: (low, high) of difference distribution
        rope: (-rope_width, +rope_width)
        hdi_in_rope: True if HDI is entirely inside ROPE
        hdi_outside_rope: True if HDI is entirely outside ROPE
    """
    rng = np.random.default_rng(seed)
    samples_a = rng.beta(model_a.alpha, model_a.beta, size=n_samples)
    samples_b = rng.beta(model_b.alpha, model_b.beta, size=n_samples)
    diff = samples_b - samples_a

    hdi_low, hdi_high = hdi_from_samples(diff, credible_mass=0.95)

    hdi_in_rope = (hdi_low >= -rope_width) and (hdi_high <= rope_width)
    hdi_outside_rope = (hdi_low > rope_width) or (hdi_high < -rope_width)

    if hdi_in_rope:
        decision = "equivalent"
    elif hdi_outside_rope:
        if hdi_low > rope_width:
            decision = "ship_b"
        else:
            decision = "ship_a"
    else:
        decision = "undecided"

    return {
        "decision": decision,
        "hdi": (round(float(hdi_low), 6), round(float(hdi_high), 6)),
        "rope": (-rope_width, rope_width),
        "hdi_in_rope": hdi_in_rope,
        "hdi_outside_rope": hdi_outside_rope,
    }


def multi_variant_rope_decision(
    models: list[BetaBinomial],
    variant_keys: list[str],
    rope_width: float = 0.005,
    n_samples: int = 50_000,
    seed: int = 42,
) -> dict:
    """Pairwise ROPE decisions between the leader and all other variants.

    Parameters
    ----------
    models : list[BetaBinomial]
        One model per variant.
    variant_keys : list[str]
        Variant key names.
    rope_width : float
        ROPE half-width.

    Returns
    -------
    dict
        leader: str, pairwise: list of rope_decision results
    """
    # Find leader (highest posterior mean)
    means = [m.posterior_mean() for m in models]
    leader_idx = int(np.argmax(means))
    leader_key = variant_keys[leader_idx]

    pairwise = []
    for i, (model, key) in enumerate(zip(models, variant_keys)):
        if i == leader_idx:
            continue
        result = rope_decision(models[leader_idx], model, rope_width, n_samples, seed)
        result["variant_a"] = leader_key
        result["variant_b"] = key
        pairwise.append(result)

    return {
        "leader": leader_key,
        "pairwise": pairwise,
    }


# ======================================================================
# Recommendation generation
# ======================================================================

def generate_recommendation(
    analysis: dict,
    loss_threshold: float = 0.005,
    rope_width: float = 0.005,
) -> dict:
    """Generate a structured recommendation from the analysis dict.

    The ``analysis`` dict is expected to contain:

    - ``variants``: list of per-variant dicts with ``visitors``,
      ``conversions``, ``variant_key``
    - ``probability_best``: list of P(variant_i is best) (optional)
    - ``probability_b_beats_a``: float (optional, 2-variant case)
    - ``expected_loss``: list of floats per variant (optional)
    - ``engagement_comparison``: dict with ``summary`` key (optional)
    - ``models``: list of BetaBinomial posteriors (optional, for ROPE)

    Returns
    -------
    dict
        decision_status: "collecting_data" | "keep_testing" | "ready_to_ship" | "practically_equivalent"
        recommendation: str (markdown-formatted)
        winning_variant: str | None
        confidence_level: str | None ("low" | "medium" | "high")
        rope_analysis: dict | None
    """
    variants = analysis.get("variants", [])
    total_visitors = sum(v.get("visitors", 0) for v in variants)
    total_conversions = sum(v.get("conversions", 0) for v in variants)

    result = {
        "decision_status": "collecting_data",
        "recommendation": "",
        "winning_variant": None,
        "confidence_level": None,
        "rope_analysis": None,
    }

    # ---- Very early: fewer than 10 total visitors ----
    if total_visitors < 10:
        result["recommendation"] = (
            f"**Just getting started.** Only {total_visitors} "
            f"visitor{'s' if total_visitors != 1 else ''} so far. "
            "Need more data for any meaningful comparison."
        )
        return result

    # ---- No conversions but we may have engagement data ----
    if total_conversions == 0:
        engagement = analysis.get("engagement_comparison")
        if engagement and engagement.get("summary"):
            result["recommendation"] = (
                "**Not enough conversions yet**, but engagement data is available. "
                + engagement["summary"]
                + " This usually predicts better conversion."
            )
        else:
            result["recommendation"] = (
                f"**Too early to tell.** After {total_visitors} visitors, "
                "no conversions have been recorded. Keep testing."
            )
        return result

    # ---- Determine best variant using probability_best or prob_b_beats_a ----
    prob_best = analysis.get("probability_best")
    exp_loss = analysis.get("expected_loss")
    models = analysis.get("models")

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
        result["recommendation"] = (
            f"**Too early to tell.** After {total_visitors} visitors, "
            "the variants look similar. Keep testing."
        )
        return result

    best_key = best_variant.get("variant_key", f"#{best_idx}")
    best_prob_pct = best_prob * 100

    # Compute gain from expected loss if available
    gain_str = ""
    if exp_loss is not None and len(exp_loss) == len(variants):
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
            result["recommendation"] = (
                f"**Not enough conversions yet**, but Variant {best_key} "
                f"visitors {engagement_insight.lower()} "
                "This usually predicts better conversion."
            )
        else:
            result["recommendation"] = (
                f"**Too early to tell.** After {total_visitors} visitors, "
                "the variants look similar. Keep testing."
            )
        return result

    # ---- ROPE analysis (if models available) ----
    rope_result = None
    if models and len(models) >= 2:
        variant_keys = [v.get("variant_key", f"#{i}") for i, v in enumerate(variants)]
        if len(models) == 2:
            rope_result = rope_decision(models[0], models[1], rope_width)
        else:
            rope_result = multi_variant_rope_decision(models, variant_keys, rope_width)
        result["rope_analysis"] = rope_result

    # ---- Decision hierarchy ----
    # 1. Epsilon stopping: if min expected loss < threshold
    if exp_loss is not None and len(exp_loss) == len(variants):
        min_loss = min(exp_loss)
        min_loss_idx = exp_loss.index(min_loss)
        min_loss_key = variants[min_loss_idx].get("variant_key", f"#{min_loss_idx}")

        if min_loss < loss_threshold:
            result["decision_status"] = "ready_to_ship"
            result["winning_variant"] = min_loss_key
            result["confidence_level"] = "high"
            result["recommendation"] = (
                f"**Ready to ship Variant {min_loss_key}.** "
                f"Expected loss is only {min_loss * 100:.3f}% (below {loss_threshold * 100:.3f}% threshold).{gain_str} "
                f"{best_prob_pct:.0f}% probability of being best."
            )
            return result

    # 2. ROPE equivalence
    if rope_result:
        rope_dec = rope_result.get("decision") if "decision" in rope_result else None
        # For multi-variant, check if all pairwise are equivalent
        if rope_dec is None and "pairwise" in rope_result:
            pairwise = rope_result["pairwise"]
            if pairwise and all(p.get("decision") == "equivalent" for p in pairwise):
                rope_dec = "equivalent"

        if rope_dec == "equivalent":
            result["decision_status"] = "practically_equivalent"
            result["confidence_level"] = "high"
            result["recommendation"] = (
                "**Variants are practically equivalent.** "
                "The difference falls within the Region of Practical Equivalence "
                f"(ROPE: +/-{rope_width * 100:.1f}%). Pick whichever you prefer."
            )
            return result

    # 3. Fallback: P(best) >= 0.90
    if best_prob >= 0.90:
        result["decision_status"] = "ready_to_ship"
        result["winning_variant"] = best_key
        result["confidence_level"] = "high"
        result["recommendation"] = (
            f"**Variant {best_key} is winning.** "
            f"{best_prob_pct:.0f}% chance it converts better.{gain_str} "
            "We recommend switching."
        )
        return result

    # 4. P(best) >= 0.75
    if best_prob >= 0.75:
        result["decision_status"] = "keep_testing"
        result["winning_variant"] = best_key
        result["confidence_level"] = "medium"
        result["recommendation"] = (
            f"**Variant {best_key} is likely better** "
            f"({best_prob_pct:.0f}% probability).{gain_str} "
            "Keep running for more confidence before committing."
        )
        return result

    # 5. Too close to call
    result["decision_status"] = "collecting_data"
    result["confidence_level"] = "low"
    result["recommendation"] = (
        f"**Too early to tell.** After {total_visitors} visitors, "
        "the variants look similar. Keep testing."
    )
    return result
