"""Tests for the StatsEngine orchestration layer (``analyze_experiment``).

The engine's DB-backed count helpers rely on PostgreSQL-specific JSONB
operators, so they cannot run against an in-memory SQLite database. Instead we
subclass :class:`StatsEngine` and override the three query helpers with canned
data, and back it with a fake session whose queries return empty results — which
makes the prior resolver and shrinkage step fall back to their defaults. This
lets the full ~250-line orchestration run deterministically with no live server.

Primary regression covered: a visitor who converts more than once (e.g. a CTA
clicked twice fires two ``goal_completed`` events) used to make conversions
exceed the visitor count, raising ``ValueError("successes cannot exceed
trials")`` inside ``BetaBinomial.update`` and surfacing as a 500 on
``GET /experiments/{id}/results``.
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.stats.engine import StatsEngine


# ----------------------------------------------------------------------
# Test doubles
# ----------------------------------------------------------------------


class _FakeResult:
    """Minimal stand-in for a SQLAlchemy ``Result``.

    Only the prior resolver and shrinkage step reach the real session (the
    count helpers are overridden below). Both call ``.all()``; returning an
    empty list makes them fall back to the platform-default prior and skip
    shrinkage, so the canned counts fully determine the analysis.
    """

    def all(self):
        return []

    def scalar(self):
        return 0


class _FakeSession:
    async def execute(self, *_args, **_kwargs):
        return _FakeResult()


class StubEngine(StatsEngine):
    """StatsEngine with DB-backed counting replaced by canned per-variant data."""

    def __init__(self, visitors, conversions, engagement=None, confirmed_types=None):
        super().__init__(_FakeSession())
        self._visitors = visitors
        self._conversions = conversions
        self._engagement = engagement or {}
        self._confirmed_types = confirmed_types or set()
        self.confirmed_type_calls = 0

    async def _get_confirmed_goal_types(self, project_id):
        self.confirmed_type_calls += 1
        return self._confirmed_types

    async def _count_visitors(self, project_id, experiment_key, variant_key):
        return self._visitors.get(variant_key, 0)

    async def _count_conversions(
        self, project_id, experiment_key, variant_key, confirmed_types
    ):
        return self._conversions.get(variant_key, 0)

    async def _get_engagement_events(self, project_id, experiment_key, variant_key):
        return self._engagement.get(variant_key, [])


def make_experiment(variant_keys, **overrides):
    base = dict(
        id=uuid4(),
        key="exp-test",
        project_id=uuid4(),
        variant_keys=variant_keys,
        expected_conversion_rate=None,
        prior_confidence=None,
        loss_threshold=0.005,
        rope_width=0.005,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _analyze(engine, experiment):
    return asyncio.run(engine.analyze_experiment(experiment))


# ----------------------------------------------------------------------
# Happy path
# ----------------------------------------------------------------------


def test_two_variant_normal_analysis():
    engine = StubEngine(
        visitors={"control": 100, "variant": 100},
        conversions={"control": 5, "variant": 12},
    )
    result = _analyze(engine, make_experiment(["control", "variant"]))

    assert result["total_visitors"] == 200
    variants = {v["variant_key"]: v for v in result["variants"]}
    assert variants["control"]["conversions"] == 5
    assert variants["variant"]["conversions"] == 12
    assert variants["control"]["conversion_rate"] == 0.05
    assert variants["variant"]["conversion_rate"] == 0.12
    # Two-variant comparison metrics are populated.
    assert result["probability_b_beats_a"] is not None
    assert result["probability_best"] is not None
    assert result["expected_loss"] is not None


def test_zero_visitors_is_safe():
    engine = StubEngine(visitors={}, conversions={})
    result = _analyze(engine, make_experiment(["control", "variant"]))

    assert result["total_visitors"] == 0
    for v in result["variants"]:
        assert v["conversions"] == 0
        assert v["conversion_rate"] == 0.0


# ----------------------------------------------------------------------
# Regression: conversions must never exceed visitors
# ----------------------------------------------------------------------


def test_conversions_exceeding_visitors_do_not_crash():
    # One variant reports more conversions than visitors — the situation a
    # repeat-converter produced before the fix. analyze_experiment must not
    # raise, and the conversion count must be clamped to the visitor count.
    engine = StubEngine(
        visitors={"control": 50, "variant": 2},
        conversions={"control": 5, "variant": 5},
    )
    result = _analyze(engine, make_experiment(["control", "variant"]))

    variants = {v["variant_key"]: v for v in result["variants"]}
    assert variants["variant"]["conversions"] == 2  # clamped to visitor count
    assert variants["variant"]["conversion_rate"] <= 1.0
    # Posterior remains a valid probability.
    assert 0.0 < variants["variant"]["posterior_mean"] < 1.0


def test_single_visitor_repeat_conversions_clamped():
    engine = StubEngine(visitors={"control": 1}, conversions={"control": 4})
    result = _analyze(engine, make_experiment(["control"]))

    v = result["variants"][0]
    assert v["conversions"] == 1
    assert v["conversion_rate"] == 1.0


def test_conversion_rate_never_exceeds_one_across_variants():
    engine = StubEngine(
        visitors={"a": 10, "b": 5, "c": 0},
        conversions={"a": 25, "b": 5, "c": 3},  # all >= visitors
    )
    result = _analyze(engine, make_experiment(["a", "b", "c"]))

    for v in result["variants"]:
        assert v["conversions"] <= v["visitors"]
        assert 0.0 <= v["conversion_rate"] <= 1.0


# ----------------------------------------------------------------------
# Efficiency: confirmed goal types resolved once, not per variant
# ----------------------------------------------------------------------


def test_confirmed_goal_types_queried_once_per_analysis():
    engine = StubEngine(
        visitors={"a": 30, "b": 30, "c": 30},
        conversions={"a": 3, "b": 4, "c": 5},
        confirmed_types={"signup"},
    )
    _analyze(engine, make_experiment(["a", "b", "c"]))
    # Project-scoped lookup happens once for the whole analysis regardless of
    # the number of variants (guards against the prior per-variant N+1 query).
    assert engine.confirmed_type_calls == 1
