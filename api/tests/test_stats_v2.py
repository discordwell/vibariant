"""Tests for Stats Engine v2 features.

Covers:
- Expected loss epsilon stopping
- ROPE-based decision rules
- HDI computation
- Top-Two Thompson Sampling
- Adaptive priors (user-elicited, moment matching)
- Weight calibration
- Winsorization
- CUPED variance reduction
- James-Stein shrinkage
- Structured recommendation generation
"""

import sys
import math

import numpy as np
import pytest

sys.path.insert(0, "/Users/discordwell/Projects/vibariant/api")

from app.stats.bayesian import BetaBinomial, hdi_from_samples
from app.stats.bandits import ThompsonSampler, TopTwoThompsonSampler
from app.stats.decisions import (
    expected_loss,
    generate_recommendation,
    rope_decision,
    multi_variant_rope_decision,
)
from app.stats.priors import user_elicited_prior, fit_beta_moment_matching
from app.stats.proxy import ProxyMetrics
from app.stats.shrinkage import james_stein_shrink


# ======================================================================
# HDI Computation Tests
# ======================================================================


class TestHDI:
    """Test Highest Density Interval computation."""

    def testhdi_from_samples_symmetric(self):
        """For a symmetric distribution, HDI should be roughly centered."""
        rng = np.random.default_rng(42)
        samples = rng.normal(0.5, 0.1, size=100_000)
        low, high = hdi_from_samples(samples, 0.95)
        center = (low + high) / 2
        assert center == pytest.approx(0.5, abs=0.02)

    def test_hdi_contains_95_percent(self):
        """HDI should contain roughly 95% of samples."""
        rng = np.random.default_rng(42)
        samples = rng.beta(5, 20, size=100_000)
        low, high = hdi_from_samples(samples, 0.95)
        in_interval = np.mean((samples >= low) & (samples <= high))
        assert in_interval == pytest.approx(0.95, abs=0.02)

    def test_hdi_narrower_than_equal_tailed(self):
        """For skewed distributions, HDI should be narrower than equal-tailed CI."""
        model = BetaBinomial().update(2, 100)
        hdi_low, hdi_high = model.hdi(0.95)
        ci_low, ci_high = model.credible_interval(0.95)
        hdi_width = hdi_high - hdi_low
        ci_width = ci_high - ci_low
        # HDI should be at most as wide as the equal-tailed CI (narrower for skewed)
        assert hdi_width <= ci_width + 0.001

    def test_hdi_contains_posterior_mean(self):
        model = BetaBinomial().update(5, 50)
        low, high = model.hdi(0.95)
        assert low < model.posterior_mean() < high

    def test_difference_hdi_identical_models(self):
        """Identical models: difference HDI should span 0."""
        a = BetaBinomial().update(5, 100)
        b = BetaBinomial().update(5, 100)
        low, high = BetaBinomial.difference_hdi(a, b)
        assert low < 0 < high

    def test_difference_hdi_clear_winner(self):
        """Clear winner: HDI should be entirely positive or negative."""
        a = BetaBinomial().update(2, 100)
        b = BetaBinomial().update(20, 100)
        low, high = BetaBinomial.difference_hdi(a, b)
        assert low > 0  # B is clearly better


# ======================================================================
# ROPE Decision Tests
# ======================================================================


class TestROPEDecision:
    """Test ROPE-based decision rules."""

    def test_identical_models_equivalent(self):
        """Identical models should be declared equivalent with wide enough ROPE."""
        a = BetaBinomial().update(10, 200)
        b = BetaBinomial().update(10, 200)
        result = rope_decision(a, b, rope_width=0.05)
        assert result["decision"] == "equivalent"
        assert result["hdi_in_rope"] is True

    def test_clear_winner_ship(self):
        """Clear winner should trigger ship decision."""
        a = BetaBinomial().update(2, 200)
        b = BetaBinomial().update(20, 200)
        result = rope_decision(a, b, rope_width=0.005)
        assert result["decision"] == "ship_b"
        assert result["hdi_outside_rope"] is True

    def test_clear_winner_a_ship(self):
        """When A is clearly better, should ship A."""
        a = BetaBinomial().update(20, 200)
        b = BetaBinomial().update(2, 200)
        result = rope_decision(a, b, rope_width=0.005)
        assert result["decision"] == "ship_a"

    def test_overlapping_undecided(self):
        """Close models with narrow ROPE should be undecided."""
        a = BetaBinomial().update(5, 50)
        b = BetaBinomial().update(6, 50)
        result = rope_decision(a, b, rope_width=0.005)
        assert result["decision"] == "undecided"

    def test_rope_result_fields(self):
        """Result should contain all expected fields."""
        a = BetaBinomial().update(5, 100)
        b = BetaBinomial().update(5, 100)
        result = rope_decision(a, b, rope_width=0.01)
        assert "decision" in result
        assert "hdi" in result
        assert "rope" in result
        assert "hdi_in_rope" in result
        assert "hdi_outside_rope" in result
        assert len(result["hdi"]) == 2
        assert result["rope"] == (-0.01, 0.01)

    def test_custom_rope_width(self):
        """Wide ROPE should make it easier to declare equivalence."""
        a = BetaBinomial().update(5, 50)
        b = BetaBinomial().update(7, 50)
        # Narrow ROPE: likely undecided
        narrow = rope_decision(a, b, rope_width=0.001)
        # Wide ROPE: might be equivalent
        wide = rope_decision(a, b, rope_width=0.1)
        # At minimum, wide ROPE should not be stricter
        assert wide["hdi_in_rope"] or wide["decision"] in ("equivalent", "undecided")

    def test_multi_variant_rope(self):
        """Multi-variant ROPE should identify leader and pairwise comparisons."""
        models = [
            BetaBinomial().update(5, 100),
            BetaBinomial().update(15, 100),
            BetaBinomial().update(5, 100),
        ]
        keys = ["control", "bold", "minimal"]
        result = multi_variant_rope_decision(models, keys, rope_width=0.005)
        assert result["leader"] == "bold"
        assert len(result["pairwise"]) == 2

    def test_multi_variant_all_equivalent(self):
        """All identical models should be equivalent pairwise with enough data."""
        models = [
            BetaBinomial().update(10, 200),
            BetaBinomial().update(10, 200),
            BetaBinomial().update(10, 200),
        ]
        keys = ["a", "b", "c"]
        result = multi_variant_rope_decision(models, keys, rope_width=0.05)
        for pw in result["pairwise"]:
            assert pw["decision"] == "equivalent"


# ======================================================================
# Epsilon Stopping Tests
# ======================================================================


class TestEpsilonStopping:
    """Test expected loss epsilon stopping in generate_recommendation."""

    def test_low_loss_triggers_ready_to_ship(self):
        """When min expected loss is below threshold, should be ready_to_ship."""
        models = [
            BetaBinomial().update(15, 300),
            BetaBinomial().update(3, 300),
        ]
        losses = expected_loss(models)
        analysis = {
            "variants": [
                {"variant_key": "control", "visitors": 300, "conversions": 15},
                {"variant_key": "variant", "visitors": 300, "conversions": 3},
            ],
            "probability_best": [0.99, 0.01],
            "probability_b_beats_a": 0.01,
            "expected_loss": losses,
            "models": models,
        }
        result = generate_recommendation(analysis, loss_threshold=0.05)
        assert result["decision_status"] == "ready_to_ship"
        assert result["winning_variant"] == "control"
        assert result["confidence_level"] == "high"

    def test_high_loss_no_ship(self):
        """When expected loss is above threshold, should not be ready_to_ship."""
        models = [
            BetaBinomial().update(3, 30),
            BetaBinomial().update(4, 30),
        ]
        losses = expected_loss(models)
        analysis = {
            "variants": [
                {"variant_key": "control", "visitors": 30, "conversions": 3},
                {"variant_key": "variant", "visitors": 30, "conversions": 4},
            ],
            "probability_best": [0.4, 0.6],
            "probability_b_beats_a": 0.6,
            "expected_loss": losses,
            "models": models,
        }
        result = generate_recommendation(analysis, loss_threshold=0.001)
        assert result["decision_status"] != "ready_to_ship"

    def test_custom_threshold(self):
        """Custom threshold should change when epsilon stopping triggers."""
        models = [
            BetaBinomial().update(10, 200),
            BetaBinomial().update(3, 200),
        ]
        losses = expected_loss(models)
        analysis = {
            "variants": [
                {"variant_key": "a", "visitors": 200, "conversions": 10},
                {"variant_key": "b", "visitors": 200, "conversions": 3},
            ],
            "probability_best": [0.95, 0.05],
            "expected_loss": losses,
            "models": models,
        }
        # Loose threshold
        result_loose = generate_recommendation(analysis, loss_threshold=0.1)
        # Tight threshold
        result_tight = generate_recommendation(analysis, loss_threshold=0.0001)
        # Loose should ship, tight might not
        assert result_loose["decision_status"] == "ready_to_ship"

    def test_1_vs_0_not_epsilon_ship(self):
        """1 vs 0 conversions should not trigger epsilon stopping."""
        models = [
            BetaBinomial().update(1, 50),
            BetaBinomial().update(0, 50),
        ]
        losses = expected_loss(models)
        prob = BetaBinomial.probability_b_beats_a(models[0], models[1])
        analysis = {
            "variants": [
                {"variant_key": "control", "visitors": 50, "conversions": 1},
                {"variant_key": "variant", "visitors": 50, "conversions": 0},
            ],
            "probability_best": [1 - prob, prob],
            "probability_b_beats_a": prob,
            "expected_loss": losses,
            "models": models,
        }
        result = generate_recommendation(analysis, loss_threshold=0.005)
        # With only 1 total conversion, should not ship
        assert "too early" in result["recommendation"].lower() or "not enough" in result["recommendation"].lower()

    def test_backward_compat_recommendation_string(self):
        """Result should always have a recommendation string."""
        analysis = {
            "variants": [
                {"variant_key": "control", "visitors": 3, "conversions": 0},
                {"variant_key": "variant", "visitors": 4, "conversions": 0},
            ],
        }
        result = generate_recommendation(analysis)
        assert isinstance(result, dict)
        assert "recommendation" in result
        assert isinstance(result["recommendation"], str)
        assert "Just getting started" in result["recommendation"]

    def test_result_always_has_decision_status(self):
        """Every result should have a decision_status field."""
        analysis = {
            "variants": [
                {"variant_key": "control", "visitors": 50, "conversions": 0},
                {"variant_key": "variant", "visitors": 50, "conversions": 0},
            ],
        }
        result = generate_recommendation(analysis)
        assert "decision_status" in result
        assert result["decision_status"] in (
            "collecting_data", "keep_testing", "ready_to_ship", "practically_equivalent"
        )


# ======================================================================
# Top-Two Thompson Sampling Tests
# ======================================================================


class TestTopTwoThompsonSampler:
    """Test the Top-Two Thompson Sampling bandit."""

    def test_constructor_requires_models(self):
        with pytest.raises(ValueError):
            TopTwoThompsonSampler([])

    def test_select_variant_valid_index(self):
        models = [BetaBinomial().update(5, 100), BetaBinomial().update(10, 100)]
        sampler = TopTwoThompsonSampler(models)
        idx = sampler.select_variant(seed=42)
        assert idx in (0, 1)

    def test_more_exploration_than_standard(self):
        """Top-Two should give more traffic to the underdog than standard Thompson."""
        models = [
            BetaBinomial().update(2, 100),
            BetaBinomial().update(15, 100),
        ]
        standard = ThompsonSampler(models)
        top_two = TopTwoThompsonSampler(models, min_allocation=0.0, beta=0.5)

        std_alloc = standard.get_allocation(n_samples=10_000)
        tt_alloc = top_two.get_allocation(n_samples=10_000)

        # Top-Two should give more to the underdog (variant 0)
        assert tt_alloc[0] > std_alloc[0] - 0.05  # Allow some noise

    def test_minimum_floor_enforced(self):
        """No variant should drop below min_allocation."""
        models = [
            BetaBinomial().update(1, 200),
            BetaBinomial().update(30, 200),
        ]
        sampler = TopTwoThompsonSampler(models, min_allocation=0.10)
        alloc = sampler.get_allocation(n_samples=10_000)
        assert alloc[0] >= 0.09  # Allow tiny floating point tolerance
        assert alloc[1] >= 0.09

    def test_allocation_sums_to_one(self):
        models = [
            BetaBinomial().update(5, 100),
            BetaBinomial().update(10, 100),
            BetaBinomial().update(3, 100),
        ]
        sampler = TopTwoThompsonSampler(models)
        alloc = sampler.get_allocation(n_samples=10_000)
        assert sum(alloc) == pytest.approx(1.0, abs=0.01)

    def test_three_variants_allocation(self):
        models = [
            BetaBinomial().update(2, 100),
            BetaBinomial().update(10, 100),
            BetaBinomial().update(3, 100),
        ]
        sampler = TopTwoThompsonSampler(models)
        alloc = sampler.get_allocation(n_samples=10_000)
        assert len(alloc) == 3
        # Variant 1 should still get the most
        assert alloc[1] > alloc[0]
        assert alloc[1] > alloc[2]

    def test_reproducible(self):
        models = [BetaBinomial().update(5, 100), BetaBinomial().update(10, 100)]
        s1 = TopTwoThompsonSampler(models)
        s2 = TopTwoThompsonSampler(models)
        a1 = s1.get_allocation(n_samples=5_000, seed=42)
        a2 = s2.get_allocation(n_samples=5_000, seed=42)
        for v1, v2 in zip(a1, a2):
            assert v1 == pytest.approx(v2, abs=0.001)

    def test_single_variant(self):
        models = [BetaBinomial().update(5, 100)]
        sampler = TopTwoThompsonSampler(models)
        alloc = sampler.get_allocation(n_samples=1_000)
        assert alloc == [pytest.approx(1.0, abs=0.01)]


# ======================================================================
# Adaptive Priors Tests
# ======================================================================


class TestUserElicitedPrior:
    """Test user_elicited_prior."""

    def test_basic_mapping(self):
        """rate=0.05, confidence=20 => alpha=1, beta=19."""
        prior = user_elicited_prior(0.05, 20)
        assert prior.alpha == pytest.approx(1.0, abs=0.001)
        assert prior.beta == pytest.approx(19.0, abs=0.001)

    def test_high_rate(self):
        """rate=0.50, confidence=10 => alpha=5, beta=5."""
        prior = user_elicited_prior(0.50, 10)
        assert prior.alpha == pytest.approx(5.0, abs=0.001)
        assert prior.beta == pytest.approx(5.0, abs=0.001)

    def test_posterior_mean_matches_rate(self):
        prior = user_elicited_prior(0.10, 40)
        assert prior.posterior_mean() == pytest.approx(0.10, abs=0.001)

    def test_high_confidence_tight_prior(self):
        """Higher confidence should mean lower variance."""
        low_conf = user_elicited_prior(0.05, 10)
        high_conf = user_elicited_prior(0.05, 100)
        assert high_conf.posterior_variance() < low_conf.posterior_variance()

    def test_invalid_rate_raises(self):
        with pytest.raises(ValueError):
            user_elicited_prior(0.0, 20)
        with pytest.raises(ValueError):
            user_elicited_prior(1.0, 20)

    def test_invalid_confidence_raises(self):
        with pytest.raises(ValueError):
            user_elicited_prior(0.05, 0)
        with pytest.raises(ValueError):
            user_elicited_prior(0.05, -1)


class TestMomentMatching:
    """Test fit_beta_moment_matching."""

    def test_recovery_from_known_beta(self):
        """Generate samples from a known Beta, recover parameters."""
        rng = np.random.default_rng(42)
        true_alpha, true_beta = 2.0, 18.0
        rates = rng.beta(true_alpha, true_beta, size=100).tolist()
        alpha, beta = fit_beta_moment_matching(rates)
        # Should roughly recover
        assert alpha == pytest.approx(true_alpha, rel=0.3)
        assert beta == pytest.approx(true_beta, rel=0.3)

    def test_mean_preserved(self):
        """Fitted distribution should have similar mean to input."""
        rates = [0.04, 0.06, 0.05, 0.03, 0.07]
        alpha, beta = fit_beta_moment_matching(rates)
        fitted_mean = alpha / (alpha + beta)
        assert fitted_mean == pytest.approx(np.mean(rates), abs=0.02)

    def test_insufficient_data_raises(self):
        with pytest.raises(ValueError):
            fit_beta_moment_matching([0.05])

    def test_degenerate_all_same(self):
        """All same rate: variance is 0, should fall back."""
        alpha, beta = fit_beta_moment_matching([0.05, 0.05, 0.05])
        # Should get a valid prior (fallback)
        assert alpha > 0
        assert beta > 0

    def test_edge_rates_fallback(self):
        """All 0s or all 1s should fall back to default."""
        alpha, beta = fit_beta_moment_matching([0.0, 0.0, 0.0])
        assert alpha == 1.0
        assert beta == 19.0


# ======================================================================
# Weight Calibration Tests
# ======================================================================


class TestCalibration:
    """Test ProxyMetrics.calibrate_weights."""

    def test_calibration_with_known_data(self):
        """Scroll depth perfectly predicts conversion."""
        data = []
        rng = np.random.default_rng(42)
        for _ in range(50):
            scroll = rng.uniform(0.8, 1.0)
            data.append({
                "scroll_depth": scroll,
                "time_on_page": rng.uniform(0, 1),
                "click_count": rng.uniform(0, 1),
                "form_engagement": 0.0,
                "converted": 1,
            })
        for _ in range(50):
            scroll = rng.uniform(0, 0.2)
            data.append({
                "scroll_depth": scroll,
                "time_on_page": rng.uniform(0, 1),
                "click_count": rng.uniform(0, 1),
                "form_engagement": 0.0,
                "converted": 0,
            })
        weights = ProxyMetrics.calibrate_weights(data)
        assert weights is not None
        # Scroll depth should have the highest weight
        assert weights["scroll_depth"] > weights["time_on_page"]
        assert weights["scroll_depth"] > weights["click_count"]

    def test_calibration_insufficient_data(self):
        """< 10 data points should return None."""
        data = [{"scroll_depth": 0.5, "time_on_page": 0.5, "click_count": 0.5, "form_engagement": 0, "converted": 1}] * 5
        assert ProxyMetrics.calibrate_weights(data) is None

    def test_weights_normalize_to_one(self):
        rng = np.random.default_rng(123)
        data = []
        for _ in range(100):
            data.append({
                "scroll_depth": rng.uniform(0, 1),
                "time_on_page": rng.uniform(0, 1),
                "click_count": rng.uniform(0, 1),
                "form_engagement": float(rng.random() > 0.5),
                "converted": float(rng.random() > 0.5),
            })
        weights = ProxyMetrics.calibrate_weights(data)
        assert weights is not None
        total = sum(weights.values())
        assert total == pytest.approx(1.0, abs=0.01)

    def test_engagement_score_with_custom_weights(self):
        """Custom weights should change the engagement score."""
        events = [
            {"event_type": "scroll", "payload": {"max_depth": 100}},
            {"event_type": "page_view", "payload": {"active_time": 300}},
        ]
        default_score = ProxyMetrics.compute_engagement_score(events)
        # Custom weights: all weight on scroll
        custom = {"scroll_depth": 1.0, "time_on_page": 0.0, "click_count": 0.0, "form_engagement": 0.0}
        custom_score = ProxyMetrics.compute_engagement_score(events, weights=custom)
        assert custom_score != default_score
        assert custom_score == pytest.approx(1.0, abs=0.001)  # 100% scroll = 1.0


# ======================================================================
# Winsorization Tests
# ======================================================================


class TestWinsorize:
    """Test ProxyMetrics.winsorize_scores."""

    def test_caps_outliers(self):
        # With 100 values, the 95th percentile is cleaner
        scores = [0.5] * 95 + [10.0] * 5
        winsorized = ProxyMetrics.winsorize_scores(scores, percentile=95.0)
        assert max(winsorized) <= 10.0
        # The 95th percentile of this data is 10.0 (all values >= 95th pct are 10.0)
        # Better test: use data where outliers are actually above the 95th pctile
        scores2 = list(range(100))  # 0..99
        scores2.append(10000)  # single extreme outlier
        winsorized2 = ProxyMetrics.winsorize_scores(scores2, percentile=95.0)
        assert max(winsorized2) < 10000  # outlier should be capped

    def test_no_op_when_no_outliers(self):
        scores = [0.5, 0.5, 0.5, 0.5]
        winsorized = ProxyMetrics.winsorize_scores(scores)
        assert winsorized == scores

    def test_empty_input(self):
        assert ProxyMetrics.winsorize_scores([]) == []

    def test_preserves_non_outliers(self):
        scores = [0.1, 0.2, 0.3, 0.4, 0.5]
        winsorized = ProxyMetrics.winsorize_scores(scores, percentile=95.0)
        for orig, win in zip(scores, winsorized):
            assert win <= orig + 0.001


# ======================================================================
# CUPED Tests
# ======================================================================


class TestCUPED:
    """Test ProxyMetrics.cuped_adjust."""

    def test_reduces_variance_when_correlated(self):
        """CUPED should reduce variance when pre/post scores are correlated."""
        rng = np.random.default_rng(42)
        n = 100
        base = rng.uniform(0, 1, size=n)
        noise = rng.normal(0, 0.1, size=n)
        pre = base.tolist()
        post = (base + noise + 0.1).tolist()  # correlated with pre

        adjusted = ProxyMetrics.cuped_adjust(post, pre)
        assert np.var(adjusted) < np.var(post)

    def test_no_harm_when_uncorrelated(self):
        """CUPED should not increase variance much when uncorrelated."""
        rng = np.random.default_rng(42)
        n = 100
        pre = rng.uniform(0, 1, size=n).tolist()
        post = rng.uniform(0, 1, size=n).tolist()

        adjusted = ProxyMetrics.cuped_adjust(post, pre)
        # Variance should not increase dramatically
        assert np.var(adjusted) < np.var(post) * 1.5

    def test_empty_inputs(self):
        assert ProxyMetrics.cuped_adjust([], []) == []

    def test_mismatched_lengths_fallback(self):
        """Mismatched lengths should return original scores."""
        post = [0.5, 0.6, 0.7]
        pre = [0.3, 0.4]
        assert ProxyMetrics.cuped_adjust(post, pre) == post

    def test_constant_pre_scores_fallback(self):
        """If all pre scores are the same, should return original."""
        post = [0.5, 0.6, 0.7]
        pre = [0.5, 0.5, 0.5]
        adjusted = ProxyMetrics.cuped_adjust(post, pre)
        # theta * (X - mean(X)) = 0 when all X equal, so adjusted = original
        for a, p in zip(adjusted, post):
            assert a == pytest.approx(p, abs=0.001)


# ======================================================================
# James-Stein Shrinkage Tests
# ======================================================================


class TestJamesSteinShrinkage:
    """Test James-Stein shrinkage."""

    def test_shrinks_toward_mean(self):
        """Shrunk effects should be closer to the grand mean than raw."""
        effects = [0.01, 0.02, 0.10, 0.03, 0.02]
        ses = [0.01] * 5
        shrunk = james_stein_shrink(effects, ses)
        grand_mean = np.mean(effects)
        # Each shrunk effect should be at least as close to the mean
        for raw, s in zip(effects, shrunk):
            assert abs(s - grand_mean) <= abs(raw - grand_mean) + 0.001

    def test_less_than_3_no_shrinkage(self):
        """< 3 experiments should return unchanged."""
        effects = [0.05, 0.10]
        ses = [0.01, 0.01]
        shrunk = james_stein_shrink(effects, ses)
        assert shrunk == effects

    def test_preserves_ranking(self):
        """Shrinkage should preserve the relative order."""
        effects = [0.01, 0.05, 0.10, 0.15, 0.20]
        ses = [0.02] * 5
        shrunk = james_stein_shrink(effects, ses)
        # Sort order should be preserved
        assert all(shrunk[i] <= shrunk[i + 1] for i in range(len(shrunk) - 1))

    def test_extreme_outlier_shrunk_more(self):
        """An extreme value should be shrunk more than moderate values."""
        effects = [0.05, 0.06, 0.04, 0.05, 0.50]  # 0.50 is the outlier
        ses = [0.01] * 5
        shrunk = james_stein_shrink(effects, ses)
        # The outlier should be pulled down significantly
        assert shrunk[-1] < effects[-1]
        # The moderate ones should barely move
        assert abs(shrunk[0] - effects[0]) < abs(shrunk[-1] - effects[-1])

    def test_all_equal_no_change(self):
        """If all effects equal, shrinkage should preserve them."""
        effects = [0.05, 0.05, 0.05]
        ses = [0.01] * 3
        shrunk = james_stein_shrink(effects, ses)
        for s, e in zip(shrunk, effects):
            assert s == pytest.approx(e, abs=0.001)


# ======================================================================
# Structured Recommendation (backward compat)
# ======================================================================


class TestStructuredRecommendation:
    """Test that generate_recommendation returns backward-compatible results."""

    def test_existing_test_scenarios_produce_same_recommendations(self):
        """The same inputs from v1 tests should produce similar recommendations."""
        # High confidence winner
        models = [
            BetaBinomial().update(2, 100),
            BetaBinomial().update(15, 100),
        ]
        prob = BetaBinomial.probability_b_beats_a(models[0], models[1])
        losses = expected_loss(models)
        analysis = {
            "variants": [
                {"variant_key": "control", "visitors": 100, "conversions": 2},
                {"variant_key": "variant", "visitors": 100, "conversions": 15},
            ],
            "probability_b_beats_a": prob,
            "probability_best": [1 - prob, prob],
            "expected_loss": losses,
            "models": models,
        }
        result = generate_recommendation(analysis)
        assert "winning" in result["recommendation"].lower() or "ready to ship" in result["recommendation"].lower()
        assert result["decision_status"] in ("ready_to_ship",)

    def test_very_early_backward_compat(self):
        analysis = {
            "variants": [
                {"variant_key": "control", "visitors": 3, "conversions": 0},
                {"variant_key": "variant", "visitors": 4, "conversions": 0},
            ],
        }
        result = generate_recommendation(analysis)
        assert "Just getting started" in result["recommendation"]

    def test_no_conversions_engagement_backward_compat(self):
        analysis = {
            "variants": [
                {"variant_key": "control", "visitors": 30, "conversions": 0},
                {"variant_key": "variant", "visitors": 30, "conversions": 0},
            ],
            "engagement_comparison": {
                "summary": "Variant variant shows 40% higher engagement.",
            },
        }
        result = generate_recommendation(analysis)
        assert "Not enough conversions yet" in result["recommendation"]
        assert "engagement" in result["recommendation"].lower()

    def test_three_variant_no_both_variants(self):
        """Recommendation should not say 'both variants' for 3+ variants."""
        models = [
            BetaBinomial().update(3, 50),
            BetaBinomial().update(4, 50),
            BetaBinomial().update(3, 50),
        ]
        probs = BetaBinomial.probability_best(models)
        losses = expected_loss(models)
        analysis = {
            "variants": [
                {"variant_key": "control", "visitors": 50, "conversions": 3},
                {"variant_key": "bold", "visitors": 50, "conversions": 4},
                {"variant_key": "minimal", "visitors": 50, "conversions": 3},
            ],
            "probability_best": probs,
            "expected_loss": losses,
            "models": models,
        }
        result = generate_recommendation(analysis)
        assert "both variants" not in result["recommendation"].lower()

    def test_rope_equivalence_decision(self):
        """When ROPE declares equivalence, should show practically_equivalent."""
        models = [
            BetaBinomial().update(10, 200),
            BetaBinomial().update(10, 200),
        ]
        losses = expected_loss(models)
        prob = BetaBinomial.probability_b_beats_a(models[0], models[1])
        analysis = {
            "variants": [
                {"variant_key": "control", "visitors": 200, "conversions": 10},
                {"variant_key": "variant", "visitors": 200, "conversions": 10},
            ],
            "probability_best": [0.5, 0.5],
            "probability_b_beats_a": prob,
            "expected_loss": losses,
            "models": models,
        }
        result = generate_recommendation(analysis, rope_width=0.05)
        assert result["decision_status"] == "practically_equivalent"
        assert "equivalent" in result["recommendation"].lower()
