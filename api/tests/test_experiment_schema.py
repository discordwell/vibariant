"""Validation tests for the experiment request schemas.

These exercise the Pydantic models directly (no database/server), guarding the
input-validation layer that keeps malformed experiments out of the system —
most importantly the empty/duplicate ``variant_keys`` cases that would
otherwise break deterministic assignment and the public ``/init`` endpoint.
"""

import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, "/Users/discordwell/Projects/vibariant/api")

from uuid import uuid4

from app.routers.experiments import ExperimentCreate, ExperimentUpdate


def _create(**overrides):
    base = {"project_id": uuid4(), "key": "exp-key", "name": "Exp Name"}
    base.update(overrides)
    return ExperimentCreate(**base)


class TestExperimentCreateValid:
    def test_defaults(self):
        exp = _create()
        assert exp.variant_keys == ["control", "variant"]
        assert exp.traffic_percentage == 1.0
        assert exp.loss_threshold == 0.005
        assert exp.rope_width == 0.005

    def test_variant_keys_are_stripped(self):
        exp = _create(variant_keys=["  control  ", "variant"])
        assert exp.variant_keys == ["control", "variant"]

    def test_accepts_boundary_values(self):
        exp = _create(
            traffic_percentage=0.0,
            loss_threshold=1.0,
            rope_width=0.0,
            expected_conversion_rate=0.5,
            prior_confidence=50.0,
        )
        assert exp.traffic_percentage == 0.0
        assert exp.expected_conversion_rate == 0.5


class TestExperimentCreateVariantKeys:
    def test_empty_rejected(self):
        # Regression guard: empty variants previously 500-ed /init.
        with pytest.raises(ValidationError):
            _create(variant_keys=[])

    def test_single_variant_allowed(self):
        # A single variant is an unusual but non-crashing rollout pattern
        # (everyone assigned to the one variant); we only forbid the empty
        # list. Preserves pre-existing behaviour.
        assert _create(variant_keys=["control"]).variant_keys == ["control"]

    def test_duplicates_rejected(self):
        with pytest.raises(ValidationError):
            _create(variant_keys=["a", "a"])

    def test_duplicates_after_strip_rejected(self):
        with pytest.raises(ValidationError):
            _create(variant_keys=["a", " a "])

    def test_blank_rejected(self):
        with pytest.raises(ValidationError):
            _create(variant_keys=["a", "   "])


class TestExperimentCreateNumericBounds:
    @pytest.mark.parametrize("value", [-0.01, 1.01, 2.0])
    def test_traffic_percentage_out_of_range(self, value):
        with pytest.raises(ValidationError):
            _create(traffic_percentage=value)

    @pytest.mark.parametrize("field", ["loss_threshold", "rope_width"])
    @pytest.mark.parametrize("value", [-0.1, 1.5])
    def test_threshold_out_of_range(self, field, value):
        with pytest.raises(ValidationError):
            _create(**{field: value})

    @pytest.mark.parametrize("value", [0.0, 1.0, -0.5, 1.5])
    def test_expected_conversion_rate_must_be_open_unit_interval(self, value):
        with pytest.raises(ValidationError):
            _create(expected_conversion_rate=value)

    @pytest.mark.parametrize("value", [0.0, -1.0])
    def test_prior_confidence_must_be_positive(self, value):
        with pytest.raises(ValidationError):
            _create(prior_confidence=value)

    def test_blank_key_rejected(self):
        with pytest.raises(ValidationError):
            _create(key="")

    def test_blank_name_rejected(self):
        with pytest.raises(ValidationError):
            _create(name="")


class TestExperimentUpdate:
    def test_empty_update_is_valid(self):
        # PATCH with no fields set is a no-op, not an error.
        assert ExperimentUpdate().model_dump(exclude_unset=True) == {}

    def test_partial_update_is_valid(self):
        assert ExperimentUpdate(name="renamed").name == "renamed"

    def test_valid_variant_keys(self):
        assert ExperimentUpdate(variant_keys=["a", "b"]).variant_keys == ["a", "b"]

    def test_none_variant_keys_allowed(self):
        # Explicit None means "don't change variants" — must not trip the validator.
        assert ExperimentUpdate(variant_keys=None).variant_keys is None

    @pytest.mark.parametrize("bad", [[], ["a", "a"], ["a", ""]])
    def test_invalid_variant_keys_rejected(self, bad):
        with pytest.raises(ValidationError):
            ExperimentUpdate(variant_keys=bad)

    def test_single_variant_update_allowed(self):
        assert ExperimentUpdate(variant_keys=["solo"]).variant_keys == ["solo"]

    @pytest.mark.parametrize(
        "bad",
        [
            {"traffic_percentage": 2.0},
            {"traffic_percentage": -0.1},
            {"rope_width": -1.0},
            {"loss_threshold": 5.0},
            {"expected_conversion_rate": 1.0},
            {"prior_confidence": 0.0},
        ],
    )
    def test_invalid_numeric_rejected(self, bad):
        with pytest.raises(ValidationError):
            ExperimentUpdate(**bad)
