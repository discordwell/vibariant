"""Comprehensive tests for the VibeVariant Bayesian stats engine.

Tests cover:
- BetaBinomial with known inputs (1 success in 50 trials, 0 in 50, etc.)
- probability_b_beats_a matches expected ranges
- Expected loss values are reasonable
- Proxy metric scoring
- Recommendation generation for each scenario
- The "1 conversion vs 0 conversions" edge case
"""

import sys

import numpy as np
import pytest

sys.path.insert(0, "/Users/discordwell/Projects/vibevariant/api")

from app.stats.bayesian import BetaBinomial
from app.stats.bandits import ThompsonSampler
from app.stats.decisions import expected_loss, generate_recommendation
from app.stats.proxy import ProxyMetrics


# ======================================================================
# BetaBinomial Tests
# ======================================================================


class TestBetaBinomialBasics:
    """Test basic construction, update, and posterior summaries."""

    def test_default_prior(self):
        """Default prior should be Beta(1, 19) encoding ~5% expected rate."""
        model = BetaBinomial()
        assert model.alpha == 1.0
        assert model.beta == 19.0
        assert model.posterior_mean() == pytest.approx(0.05, abs=1e-10)

    def test_custom_prior(self):
        model = BetaBinomial(prior_alpha=2.0, prior_beta=8.0)
        assert model.alpha == 2.0
        assert model.beta == 8.0
        assert model.posterior_mean() == pytest.approx(0.2, abs=1e-10)

    def test_invalid_prior_raises(self):
        with pytest.raises(ValueError):
            BetaBinomial(prior_alpha=0, prior_beta=1)
        with pytest.raises(ValueError):
            BetaBinomial(prior_alpha=1, prior_beta=-1)

    def test_update_returns_new_instance(self):
        """update() must return a NEW BetaBinomial, not mutate the original."""
        prior = BetaBinomial()
        posterior = prior.update(5, 100)
        # Original unchanged
        assert prior.alpha == 1.0
        assert prior.beta == 19.0
        # Posterior updated
        assert posterior.alpha == 6.0   # 1 + 5
        assert posterior.beta == 114.0  # 19 + 95
        assert posterior is not prior

    def test_update_zero_trials(self):
        """Updating with 0 trials should return an identical model."""
        prior = BetaBinomial()
        posterior = prior.update(0, 0)
        assert posterior.alpha == prior.alpha
        assert posterior.beta == prior.beta

    def test_update_validation(self):
        model = BetaBinomial()
        with pytest.raises(ValueError, match="non-negative"):
            model.update(-1, 10)
        with pytest.raises(ValueError, match="non-negative"):
            model.update(0, -1)
        with pytest.raises(ValueError, match="cannot exceed"):
            model.update(11, 10)


class TestBetaBinomialPosterior:
    """Test posterior_mean, posterior_variance, credible_interval."""

    def test_posterior_mean_1_in_50(self):
        """1 success in 50 trials: mean should be pulled toward prior."""
        model = BetaBinomial().update(1, 50)
        # alpha=2, beta=68 -> mean = 2/70 = 0.02857...
        assert model.posterior_mean() == pytest.approx(2.0 / 70.0, abs=1e-10)

    def test_posterior_mean_0_in_50(self):
        """0 successes in 50 trials: mean pulled strongly toward 0."""
        model = BetaBinomial().update(0, 50)
        # alpha=1, beta=69 -> mean = 1/70 = 0.01428...
        assert model.posterior_mean() == pytest.approx(1.0 / 70.0, abs=1e-10)

    def test_posterior_mean_50_in_100(self):
        """50 successes in 100 trials: data overwhelms the prior."""
        model = BetaBinomial().update(50, 100)
        # alpha=51, beta=69 -> mean = 51/120 = 0.425
        assert model.posterior_mean() == pytest.approx(51.0 / 120.0, abs=1e-10)

    def test_posterior_variance_formula(self):
        """Verify variance matches the analytical formula."""
        model = BetaBinomial().update(5, 100)
        a, b = model.alpha, model.beta
        expected = (a * b) / ((a + b) ** 2 * (a + b + 1))
        assert model.posterior_variance() == pytest.approx(expected, abs=1e-15)

    def test_posterior_variance_decreases_with_data(self):
        """More data should reduce posterior variance (more certainty)."""
        m10 = BetaBinomial().update(1, 10)
        m100 = BetaBinomial().update(10, 100)
        m1000 = BetaBinomial().update(100, 1000)
        assert m10.posterior_variance() > m100.posterior_variance()
        assert m100.posterior_variance() > m1000.posterior_variance()

    def test_credible_interval_contains_mean(self):
        model = BetaBinomial().update(3, 50)
        lo, hi = model.credible_interval(0.95)
        mean = model.posterior_mean()
        assert lo < mean < hi

    def test_credible_interval_width_95_vs_50(self):
        """95% CI should be wider than 50% CI."""
        model = BetaBinomial().update(5, 100)
        lo95, hi95 = model.credible_interval(0.95)
        lo50, hi50 = model.credible_interval(0.50)
        assert (hi95 - lo95) > (hi50 - lo50)

    def test_credible_interval_bounds(self):
        """Interval should be within [0, 1]."""
        model = BetaBinomial().update(0, 10)
        lo, hi = model.credible_interval(0.99)
        assert lo >= 0.0
        assert hi <= 1.0

    def test_credible_interval_invalid_width(self):
        model = BetaBinomial()
        with pytest.raises(ValueError):
            model.credible_interval(0.0)
        with pytest.raises(ValueError):
            model.credible_interval(1.0)


class TestBetaBinomialSampling:
    """Test sample() and Monte Carlo comparison methods."""

    def test_sample_shape(self):
        model = BetaBinomial().update(5, 100)
        samples = model.sample(1000, seed=42)
        assert samples.shape == (1000,)

    def test_sample_range(self):
        """All samples should be in (0, 1)."""
        model = BetaBinomial().update(5, 100)
        samples = model.sample(10000, seed=42)
        assert np.all(samples >= 0)
        assert np.all(samples <= 1)

    def test_sample_mean_close_to_posterior_mean(self):
        model = BetaBinomial().update(10, 200)
        samples = model.sample(100_000, seed=42)
        assert np.mean(samples) == pytest.approx(model.posterior_mean(), abs=0.005)

    def test_sample_reproducible(self):
        model = BetaBinomial().update(5, 50)
        s1 = model.sample(100, seed=42)
        s2 = model.sample(100, seed=42)
        np.testing.assert_array_equal(s1, s2)


class TestProbabilityBBeatsA:
    """Test probability_b_beats_a with known scenarios."""

    def test_identical_models(self):
        """Identical models -> P(B > A) should be ~0.5."""
        a = BetaBinomial().update(5, 100)
        b = BetaBinomial().update(5, 100)
        prob = BetaBinomial.probability_b_beats_a(a, b)
        assert prob == pytest.approx(0.5, abs=0.03)

    def test_clearly_better_b(self):
        """B has 20% conversion, A has 2% -> P(B > A) should be very high."""
        a = BetaBinomial().update(2, 100)
        b = BetaBinomial().update(20, 100)
        prob = BetaBinomial.probability_b_beats_a(a, b)
        assert prob > 0.99

    def test_clearly_better_a(self):
        """A has 20% conversion, B has 2% -> P(B > A) should be very low."""
        a = BetaBinomial().update(20, 100)
        b = BetaBinomial().update(2, 100)
        prob = BetaBinomial.probability_b_beats_a(a, b)
        assert prob < 0.01

    def test_1_conversion_vs_0_edge_case(self):
        """The critical edge case: 1 conversion in 50 vs 0 in 50.

        With Beta(1,19) prior, posterior for A (1 conv/50 trials) is Beta(2, 68).
        Posterior for B (0 conv/50 trials) is Beta(1, 69).
        P(A > B) should be moderately high but NOT extremely high because
        we only have 1 conversion total.
        """
        a = BetaBinomial().update(1, 50)  # 1 conversion
        b = BetaBinomial().update(0, 50)  # 0 conversions
        prob_a_better = 1 - BetaBinomial.probability_b_beats_a(a, b)
        # A should be likely better but not overwhelming
        assert 0.55 < prob_a_better < 0.95

    def test_small_sample_moderate_difference(self):
        """3 conversions in 30 vs 1 in 30: should show signal but wide CI."""
        a = BetaBinomial().update(1, 30)
        b = BetaBinomial().update(3, 30)
        prob = BetaBinomial.probability_b_beats_a(a, b)
        # B is likely better but uncertainty is high
        assert 0.55 < prob < 0.95

    def test_reproducible(self):
        a = BetaBinomial().update(5, 50)
        b = BetaBinomial().update(8, 50)
        p1 = BetaBinomial.probability_b_beats_a(a, b, seed=42)
        p2 = BetaBinomial.probability_b_beats_a(a, b, seed=42)
        assert p1 == p2


class TestProbabilityBest:
    """Test probability_best for 3+ variant scenarios."""

    def test_three_variants_clear_winner(self):
        models = [
            BetaBinomial().update(2, 100),   # ~2%
            BetaBinomial().update(10, 100),  # ~10%
            BetaBinomial().update(3, 100),   # ~3%
        ]
        probs = BetaBinomial.probability_best(models)
        assert len(probs) == 3
        assert sum(probs) == pytest.approx(1.0, abs=0.01)
        # Variant 1 (10%) should have highest probability
        assert probs[1] > probs[0]
        assert probs[1] > probs[2]
        assert probs[1] > 0.8

    def test_three_variants_all_equal(self):
        models = [
            BetaBinomial().update(5, 100),
            BetaBinomial().update(5, 100),
            BetaBinomial().update(5, 100),
        ]
        probs = BetaBinomial.probability_best(models)
        for p in probs:
            assert p == pytest.approx(1 / 3, abs=0.05)


# ======================================================================
# ThompsonSampler Tests
# ======================================================================


class TestThompsonSampler:
    """Test the Thompson Sampling bandit."""

    def test_constructor_requires_models(self):
        with pytest.raises(ValueError):
            ThompsonSampler([])

    def test_sample_best_returns_valid_index(self):
        models = [BetaBinomial().update(5, 100), BetaBinomial().update(10, 100)]
        sampler = ThompsonSampler(models)
        idx = sampler.sample_best(seed=42)
        assert idx in (0, 1)

    def test_select_variant_matches_sample_best(self):
        models = [BetaBinomial().update(5, 100), BetaBinomial().update(10, 100)]
        sampler = ThompsonSampler(models)
        # Same seed should produce same result
        assert sampler.sample_best(seed=99) == sampler.select_variant(seed=99)

    def test_allocation_favors_better_variant(self):
        """If B is clearly better, allocation should give B more traffic."""
        models = [
            BetaBinomial().update(2, 100),   # ~2%
            BetaBinomial().update(15, 100),  # ~15%
        ]
        sampler = ThompsonSampler(models)
        alloc = sampler.get_allocation(n_samples=10_000)
        assert len(alloc) == 2
        assert sum(alloc) == pytest.approx(1.0, abs=0.01)
        # B should get more traffic
        assert alloc[1] > alloc[0]
        assert alloc[1] > 0.8

    def test_allocation_equal_models(self):
        """Equal models should get roughly equal allocation."""
        models = [
            BetaBinomial().update(5, 100),
            BetaBinomial().update(5, 100),
        ]
        sampler = ThompsonSampler(models)
        alloc = sampler.get_allocation(n_samples=10_000)
        assert alloc[0] == pytest.approx(0.5, abs=0.05)
        assert alloc[1] == pytest.approx(0.5, abs=0.05)

    def test_allocation_three_variants(self):
        models = [
            BetaBinomial().update(2, 100),
            BetaBinomial().update(10, 100),
            BetaBinomial().update(3, 100),
        ]
        sampler = ThompsonSampler(models)
        alloc = sampler.get_allocation(n_samples=10_000)
        assert len(alloc) == 3
        assert sum(alloc) == pytest.approx(1.0, abs=0.01)
        # Variant 1 should get the most traffic
        assert alloc[1] > alloc[0]
        assert alloc[1] > alloc[2]


# ======================================================================
# Expected Loss Tests
# ======================================================================


class TestExpectedLoss:
    """Test expected loss computation."""

    def test_identical_models_low_loss(self):
        """If models are identical, expected loss should be very small."""
        models = [
            BetaBinomial().update(5, 100),
            BetaBinomial().update(5, 100),
        ]
        losses = expected_loss(models)
        assert len(losses) == 2
        # Both should have similar, small losses
        assert losses[0] == pytest.approx(losses[1], abs=0.005)

    def test_clear_winner_asymmetric_loss(self):
        """Picking the worse variant should have higher expected loss."""
        models = [
            BetaBinomial().update(2, 100),   # ~2%
            BetaBinomial().update(15, 100),  # ~15%
        ]
        losses = expected_loss(models)
        # Picking variant 0 (worse) has higher loss
        assert losses[0] > losses[1]
        # The loss for the bad choice should be meaningful
        assert losses[0] > 0.05

    def test_loss_is_non_negative(self):
        """Expected loss must always be >= 0."""
        models = [
            BetaBinomial().update(3, 50),
            BetaBinomial().update(7, 50),
        ]
        losses = expected_loss(models)
        assert all(l >= 0 for l in losses)

    def test_best_variant_has_lowest_loss(self):
        models = [
            BetaBinomial().update(1, 100),
            BetaBinomial().update(10, 100),
            BetaBinomial().update(5, 100),
        ]
        losses = expected_loss(models)
        best_idx = losses.index(min(losses))
        assert best_idx == 1  # 10% variant should have lowest loss

    def test_1_vs_0_conversions_loss(self):
        """Edge case: 1 conversion vs 0 should show some loss differentiation."""
        models = [
            BetaBinomial().update(1, 50),
            BetaBinomial().update(0, 50),
        ]
        losses = expected_loss(models)
        # Variant 0 (1 conversion) should have lower loss
        assert losses[0] < losses[1]


# ======================================================================
# ProxyMetrics Tests
# ======================================================================


class TestProxyMetricScoring:
    """Test engagement score computation."""

    def test_empty_events(self):
        assert ProxyMetrics.compute_engagement_score([]) == 0.0

    def test_scroll_only(self):
        """Deep scroll should contribute 0.3 * (depth/100)."""
        events = [{"event_type": "scroll", "payload": {"max_depth": 80}}]
        score = ProxyMetrics.compute_engagement_score(events)
        expected = 0.3 * (80 / 100)  # 0.24
        assert score == pytest.approx(expected, abs=0.001)

    def test_time_on_page(self):
        """150 seconds should contribute 0.2 * (150/300) = 0.1."""
        events = [{"event_type": "page_view", "payload": {"active_time": 150}}]
        score = ProxyMetrics.compute_engagement_score(events)
        expected = 0.2 * (150 / 300)  # 0.1
        assert score == pytest.approx(expected, abs=0.001)

    def test_time_on_page_capped(self):
        """Time beyond 300s should be capped."""
        events = [{"event_type": "page_view", "payload": {"active_time": 600}}]
        score = ProxyMetrics.compute_engagement_score(events)
        expected = 0.2 * 1.0  # capped at 300s -> 0.2
        assert score == pytest.approx(expected, abs=0.001)

    def test_clicks(self):
        """10 clicks should contribute 0.2 * (10/20) = 0.1."""
        events = [{"event_type": "click", "payload": {}} for _ in range(10)]
        score = ProxyMetrics.compute_engagement_score(events)
        expected = 0.2 * (10 / 20)  # 0.1
        assert score == pytest.approx(expected, abs=0.001)

    def test_clicks_capped(self):
        """30 clicks should be capped at 20."""
        events = [{"event_type": "click", "payload": {}} for _ in range(30)]
        score = ProxyMetrics.compute_engagement_score(events)
        expected = 0.2 * 1.0  # capped at 20 clicks
        assert score == pytest.approx(expected, abs=0.001)

    def test_form_engagement(self):
        """Form interaction should contribute 0.3."""
        events = [{"event_type": "form_interaction", "payload": {}}]
        score = ProxyMetrics.compute_engagement_score(events)
        expected = 0.3  # binary: 1.0
        assert score == pytest.approx(expected, abs=0.001)

    def test_full_engagement(self):
        """All signals maxed out should score 1.0."""
        events = [
            {"event_type": "scroll", "payload": {"max_depth": 100}},
            {"event_type": "page_view", "payload": {"active_time": 300}},
            *[{"event_type": "click", "payload": {}} for _ in range(20)],
            {"event_type": "form_submit", "payload": {}},
        ]
        score = ProxyMetrics.compute_engagement_score(events)
        assert score == pytest.approx(1.0, abs=0.001)

    def test_composite_score(self):
        """Mixed engagement signals combine correctly."""
        events = [
            {"event_type": "scroll", "payload": {"max_depth": 50}},  # 0.3 * 0.5 = 0.15
            {"event_type": "page_view", "payload": {"active_time": 60}},  # 0.2 * 0.2 = 0.04
            {"event_type": "click", "payload": {}},  # 1 click: 0.2 * (1/20) = 0.01
            {"event_type": "click", "payload": {}},  # 2nd click: total 2/20
        ]
        score = ProxyMetrics.compute_engagement_score(events)
        expected = 0.3 * (50 / 100) + 0.2 * (60 / 300) + 0.2 * (2 / 20) + 0.0
        assert score == pytest.approx(expected, abs=0.001)

    def test_missing_payload(self):
        """Events with no payload should not crash."""
        events = [
            {"event_type": "scroll", "payload": None},
            {"event_type": "click"},  # no payload key at all
        ]
        score = ProxyMetrics.compute_engagement_score(events)
        # scroll with no depth -> 0, click counted -> 0.2*(1/20) = 0.01
        assert score == pytest.approx(0.01, abs=0.001)


class TestProxyMetricSDKFields:
    """Test proxy metrics handle SDK camelCase field names and engagement events."""

    def test_scroll_with_camelcase_maxDepth(self):
        """SDK sends maxDepth (camelCase), not max_depth."""
        events = [{"event_type": "scroll", "payload": {"maxDepth": 75, "depth": 50, "milestone": 50}}]
        score = ProxyMetrics.compute_engagement_score(events)
        # Should use maxDepth (75), not depth (50)
        expected = 0.3 * (75 / 100)
        assert score == pytest.approx(expected, abs=0.001)

    def test_scroll_maxDepth_preferred_over_depth(self):
        """maxDepth takes priority over depth when both are present."""
        events = [{"event_type": "scroll", "payload": {"maxDepth": 90, "depth": 25}}]
        score = ProxyMetrics.compute_engagement_score(events)
        expected = 0.3 * (90 / 100)
        assert score == pytest.approx(expected, abs=0.001)

    def test_scroll_falls_back_to_max_depth_snake_case(self):
        """If maxDepth not present, fall back to max_depth then depth."""
        events = [{"event_type": "scroll", "payload": {"max_depth": 60}}]
        score = ProxyMetrics.compute_engagement_score(events)
        expected = 0.3 * (60 / 100)
        assert score == pytest.approx(expected, abs=0.001)

    def test_engagement_event_with_activeTimeMs(self):
        """SDK sends engagement events with activeTimeMs in milliseconds."""
        events = [{"event_type": "engagement", "payload": {"activeTimeMs": 150000, "totalTimeMs": 200000}}]
        score = ProxyMetrics.compute_engagement_score(events)
        # 150000ms = 150s -> 0.2 * (150/300) = 0.1
        expected = 0.2 * (150 / 300)
        assert score == pytest.approx(expected, abs=0.001)

    def test_engagement_event_with_activeTimeMs_capped(self):
        """activeTimeMs beyond 300s (300000ms) should be capped."""
        events = [{"event_type": "engagement", "payload": {"activeTimeMs": 600000}}]
        score = ProxyMetrics.compute_engagement_score(events)
        expected = 0.2 * 1.0  # capped at 300s
        assert score == pytest.approx(expected, abs=0.001)

    def test_engagement_event_combines_with_other_signals(self):
        """Engagement events should combine with scroll and click events."""
        events = [
            {"event_type": "scroll", "payload": {"maxDepth": 100}},
            {"event_type": "engagement", "payload": {"activeTimeMs": 300000}},
            *[{"event_type": "click", "payload": {}} for _ in range(20)],
            {"event_type": "form_submit", "payload": {}},
        ]
        score = ProxyMetrics.compute_engagement_score(events)
        assert score == pytest.approx(1.0, abs=0.001)

    def test_page_view_with_seconds_still_works(self):
        """page_view events with active_time in seconds should still work."""
        events = [{"event_type": "page_view", "payload": {"active_time": 120}}]
        score = ProxyMetrics.compute_engagement_score(events)
        expected = 0.2 * (120 / 300)
        assert score == pytest.approx(expected, abs=0.001)


class TestProxyMetricComparison:
    """Test compare_variants and has_sufficient_conversion_data."""

    def test_compare_two_variants(self):
        result = ProxyMetrics.compare_variants({
            "control": [0.3, 0.4, 0.5],
            "variant": [0.6, 0.7, 0.8],
        })
        assert "means" in result
        assert "differences" in result
        assert "summary" in result
        assert result["means"]["control"] == pytest.approx(0.4, abs=0.001)
        assert result["means"]["variant"] == pytest.approx(0.7, abs=0.001)
        assert "higher engagement" in result["summary"]

    def test_compare_similar_variants(self):
        result = ProxyMetrics.compare_variants({
            "control": [0.5, 0.5, 0.5],
            "variant": [0.51, 0.52, 0.49],
        })
        assert "similar" in result["summary"].lower()

    def test_compare_single_variant(self):
        result = ProxyMetrics.compare_variants({
            "control": [0.5],
        })
        assert "at least two" in result["summary"].lower()

    def test_has_sufficient_data_true(self):
        assert ProxyMetrics.has_sufficient_conversion_data(
            {"control": 5, "variant": 3}, min_conversions=3
        ) is True

    def test_has_sufficient_data_false(self):
        assert ProxyMetrics.has_sufficient_conversion_data(
            {"control": 5, "variant": 2}, min_conversions=3
        ) is False

    def test_has_sufficient_data_empty(self):
        assert ProxyMetrics.has_sufficient_conversion_data({}) is False

    def test_has_sufficient_data_zero(self):
        assert ProxyMetrics.has_sufficient_conversion_data(
            {"control": 0, "variant": 0}
        ) is False


# ======================================================================
# Recommendation Generation Tests
# ======================================================================


class TestRecommendations:
    """Test generate_recommendation for each scenario.

    Note: generate_recommendation now returns a dict. The ``recommendation``
    field contains the plain-English string.
    """

    def test_very_early_few_visitors(self):
        """< 10 visitors: 'Just getting started' message."""
        analysis = {
            "variants": [
                {"variant_key": "control", "visitors": 3, "conversions": 0},
                {"variant_key": "variant", "visitors": 4, "conversions": 0},
            ],
        }
        result = generate_recommendation(analysis)
        rec = result["recommendation"]
        assert "Just getting started" in rec
        assert "7 visitors" in rec

    def test_no_conversions_no_engagement(self):
        """Enough visitors but 0 conversions and no engagement data."""
        analysis = {
            "variants": [
                {"variant_key": "control", "visitors": 30, "conversions": 0},
                {"variant_key": "variant", "visitors": 30, "conversions": 0},
            ],
        }
        result = generate_recommendation(analysis)
        rec = result["recommendation"]
        assert "Too early to tell" in rec
        assert "60 visitors" in rec

    def test_no_conversions_but_engagement(self):
        """0 conversions but engagement data available."""
        analysis = {
            "variants": [
                {"variant_key": "control", "visitors": 30, "conversions": 0},
                {"variant_key": "variant", "visitors": 30, "conversions": 0},
            ],
            "engagement_comparison": {
                "summary": "Variant variant shows 40% higher engagement than control (0.700 vs 0.500).",
            },
        }
        result = generate_recommendation(analysis)
        rec = result["recommendation"]
        assert "Not enough conversions yet" in rec
        assert "engagement" in rec.lower()

    def test_high_confidence_winner(self):
        """Strong signal with enough conversions: recommend switching."""
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
        rec = result["recommendation"]
        assert "winning" in rec.lower() or "ready to ship" in rec.lower()

    def test_too_early_similar_variants(self):
        """Moderate data, similar conversion rates: keep testing."""
        models = [
            BetaBinomial().update(3, 50),
            BetaBinomial().update(4, 50),
        ]
        prob = BetaBinomial.probability_b_beats_a(models[0], models[1])
        losses = expected_loss(models)
        analysis = {
            "variants": [
                {"variant_key": "control", "visitors": 50, "conversions": 3},
                {"variant_key": "variant", "visitors": 50, "conversions": 4},
            ],
            "probability_b_beats_a": prob,
            "probability_best": [1 - prob, prob],
            "expected_loss": losses,
            "models": models,
        }
        result = generate_recommendation(analysis)
        rec = result["recommendation"]
        assert "keep testing" in rec.lower() or "too early" in rec.lower()

    def test_three_variant_recommendation_copy(self):
        """Recommendation should not say 'both variants' for 3+ variant experiments."""
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
        rec = result["recommendation"]
        assert "both variants" not in rec.lower()

    def test_1_vs_0_conversions_recommendation(self):
        """The critical edge case: 1 conversion vs 0.

        Should not declare a winner with so little data, but if engagement
        data is available, should reference it.
        """
        models = [
            BetaBinomial().update(1, 50),
            BetaBinomial().update(0, 50),
        ]
        prob = BetaBinomial.probability_b_beats_a(models[0], models[1])
        losses = expected_loss(models)

        # Case 1: without engagement
        analysis = {
            "variants": [
                {"variant_key": "control", "visitors": 50, "conversions": 1},
                {"variant_key": "variant", "visitors": 50, "conversions": 0},
            ],
            "probability_b_beats_a": prob,
            "probability_best": [1 - prob, prob],
            "expected_loss": losses,
            "models": models,
        }
        result = generate_recommendation(analysis)
        rec = result["recommendation"]
        assert "too early" in rec.lower() or "not enough" in rec.lower()

        # Case 2: with engagement data
        analysis["engagement_comparison"] = {
            "summary": "Variant control shows 25% higher engagement than variant.",
        }
        result2 = generate_recommendation(analysis)
        rec2 = result2["recommendation"]
        assert "not enough conversions" in rec2.lower() or "engagement" in rec2.lower()


# ======================================================================
# Integration: Full pipeline without DB
# ======================================================================


class TestStatsPipeline:
    """Test the complete stats pipeline (models -> comparison -> recommendation)
    without needing a database."""

    def test_full_pipeline_clear_winner(self):
        """Simulate an experiment where variant B clearly wins."""
        # 1. Build models
        model_a = BetaBinomial().update(3, 200)
        model_b = BetaBinomial().update(20, 200)

        # 2. Compute comparisons
        prob = BetaBinomial.probability_b_beats_a(model_a, model_b)
        assert prob > 0.99

        # 3. Expected loss
        losses = expected_loss([model_a, model_b])
        assert losses[0] > losses[1]  # picking A is riskier

        # 4. Thompson allocation
        sampler = ThompsonSampler([model_a, model_b])
        alloc = sampler.get_allocation()
        assert alloc[1] > 0.9  # most traffic to B

        # 5. Recommendation
        analysis = {
            "variants": [
                {"variant_key": "control", "visitors": 200, "conversions": 3},
                {"variant_key": "bold_cta", "visitors": 200, "conversions": 20},
            ],
            "probability_b_beats_a": prob,
            "probability_best": [1 - prob, prob],
            "expected_loss": losses,
            "models": [model_a, model_b],
        }
        result = generate_recommendation(analysis)
        rec = result["recommendation"]
        assert "winning" in rec.lower() or "ready to ship" in rec.lower()

    def test_full_pipeline_no_data(self):
        """Simulate an experiment with no events at all."""
        model_a = BetaBinomial()  # prior only
        model_b = BetaBinomial()

        prob = BetaBinomial.probability_b_beats_a(model_a, model_b)
        assert prob == pytest.approx(0.5, abs=0.03)

        analysis = {
            "variants": [
                {"variant_key": "control", "visitors": 0, "conversions": 0},
                {"variant_key": "variant", "visitors": 0, "conversions": 0},
            ],
        }
        result = generate_recommendation(analysis)
        rec = result["recommendation"]
        assert "just getting started" in rec.lower()

    def test_full_pipeline_prior_influence(self):
        """With very few observations, the prior should dominate.

        Beta(1,19) prior encodes ~5%. Even if we see 1/5 = 20% raw rate,
        the posterior mean should be much lower than 20%.
        """
        model = BetaBinomial().update(1, 5)
        # alpha=2, beta=23 -> mean = 2/25 = 0.08
        assert model.posterior_mean() == pytest.approx(0.08, abs=0.001)
        # Verify the prior is doing its job: raw rate (20%) != posterior mean (8%)
        raw_rate = 1 / 5
        assert model.posterior_mean() < raw_rate

    def test_repr(self):
        model = BetaBinomial().update(5, 100)
        assert "BetaBinomial" in repr(model)
        assert "alpha" in repr(model)
