"""Validation tests for the public SDK ingestion request schemas.

These exercise the Pydantic models for the three project-token (public)
endpoints — ``/init``, ``/events`` and ``POST /goals`` — directly, with no
database or live server (the same fast tier as ``test_experiment_schema.py``).

They guard the input-validation layer that keeps malformed SDK payloads from
reaching the database. Without these bounds an oversized ``visitor_id`` /
``event_type`` / ``label`` would overflow its ``String(255)`` / ``String(100)``
column and surface as an opaque HTTP 500, and an unbounded ``events`` array
would let a single request materialize an arbitrarily large list of ORM rows
in memory. Both are now clean 422s.
"""

import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, "/Users/discordwell/Projects/vibariant/api")

from app.routers.events import MAX_EVENTS_PER_BATCH, BatchEventsRequest, EventItem
from app.routers.goals import GoalCreate, GoalUpdate
from app.routers.init import InitRequest


def _event(**overrides) -> dict:
    base = {
        "visitor_id": "vv_visitor_1",
        "session_id": "vvs_session_1",
        "event_type": "page_view",
        "timestamp": "2026-02-26T12:00:00Z",
    }
    base.update(overrides)
    return base


# ======================================================================
# EventItem — per-event field bounds
# ======================================================================


class TestEventItemValid:
    def test_minimal_event(self):
        item = EventItem(**_event())
        assert item.event_type == "page_view"
        # Optional JSONB fields default to None.
        assert item.experiment_assignments is None
        assert item.payload is None

    def test_optional_payloads_accepted(self):
        item = EventItem(
            **_event(
                experiment_assignments={"hero-cta": "bold"},
                payload={"url": "https://example.com"},
            )
        )
        assert item.experiment_assignments == {"hero-cta": "bold"}
        assert item.payload == {"url": "https://example.com"}

    def test_max_length_boundary_accepted(self):
        at_limit = "x" * 255
        item = EventItem(**_event(visitor_id=at_limit, session_id=at_limit, event_type=at_limit))
        assert item.visitor_id == at_limit

    def test_jsonb_fields_are_intentionally_unbounded(self):
        # The hardening bounds the scalar string columns only. The JSONB
        # payload / experiment_assignments are intentionally NOT length-capped
        # here — rich SDK payloads (and many concurrent experiments) must pass.
        big_payload = {f"k{i}": "v" * 100 for i in range(200)}
        many_assignments = {f"exp-{i}": "variant" for i in range(100)}
        item = EventItem(
            **_event(experiment_assignments=many_assignments, payload=big_payload)
        )
        assert len(item.payload) == 200
        assert len(item.experiment_assignments) == 100


class TestEventItemRejected:
    @pytest.mark.parametrize("field", ["visitor_id", "session_id", "event_type"])
    def test_empty_string_rejected(self, field):
        # Empty identifiers produce junk rows and break the assignment hash.
        with pytest.raises(ValidationError):
            EventItem(**_event(**{field: ""}))

    @pytest.mark.parametrize("field", ["visitor_id", "session_id", "event_type"])
    def test_oversized_string_rejected(self, field):
        # 256 chars overflows the String(255) column -> would be a DB-level 500.
        with pytest.raises(ValidationError):
            EventItem(**_event(**{field: "x" * 256}))

    def test_missing_required_field_rejected(self):
        with pytest.raises(ValidationError):
            EventItem(visitor_id="v", session_id="s", timestamp="2026-02-26T12:00:00Z")


# ======================================================================
# BatchEventsRequest — batch-size ceiling + sendBeacon token fallback
# ======================================================================


class TestBatchEventsRequest:
    def test_small_batch_ok(self):
        req = BatchEventsRequest(events=[_event(), _event(event_type="click")])
        assert len(req.events) == 2

    def test_empty_batch_allowed(self):
        # A no-op flush is harmless (accepted: 0); stay permissive for any
        # client that posts an empty list rather than rejecting it.
        assert BatchEventsRequest(events=[]).events == []

    def test_batch_at_limit_ok(self):
        req = BatchEventsRequest(events=[_event() for _ in range(MAX_EVENTS_PER_BATCH)])
        assert len(req.events) == MAX_EVENTS_PER_BATCH

    def test_batch_over_limit_rejected(self):
        with pytest.raises(ValidationError):
            BatchEventsRequest(events=[_event() for _ in range(MAX_EVENTS_PER_BATCH + 1)])

    def test_project_token_fallback_accepted(self):
        # sendBeacon cannot set headers, so the token may arrive in the body.
        req = BatchEventsRequest(events=[_event()], projectToken="vv_proj_abc")
        assert req.projectToken == "vv_proj_abc"

    def test_project_token_optional(self):
        assert BatchEventsRequest(events=[_event()]).projectToken is None

    def test_oversized_event_in_batch_rejected(self):
        with pytest.raises(ValidationError):
            BatchEventsRequest(events=[_event(visitor_id="x" * 256)])


# ======================================================================
# InitRequest — visitor/session bounds
# ======================================================================


class TestInitRequest:
    def test_minimal_ok(self):
        req = InitRequest(visitor_id="vv_visitor_1")
        assert req.session_id is None
        assert req.attributes is None

    def test_full_ok(self):
        req = InitRequest(
            visitor_id="vv_visitor_1",
            session_id="vvs_session_1",
            attributes={"plan": "pro"},
        )
        assert req.attributes == {"plan": "pro"}

    def test_boundary_lengths_ok(self):
        at_limit = "x" * 255
        assert InitRequest(visitor_id=at_limit, session_id=at_limit).visitor_id == at_limit

    def test_empty_visitor_id_rejected(self):
        with pytest.raises(ValidationError):
            InitRequest(visitor_id="")

    def test_oversized_visitor_id_rejected(self):
        with pytest.raises(ValidationError):
            InitRequest(visitor_id="x" * 256)

    @pytest.mark.parametrize("bad", ["", "x" * 256])
    def test_invalid_session_id_rejected(self, bad):
        # session_id is optional, but a provided value must still be in bounds.
        with pytest.raises(ValidationError):
            InitRequest(visitor_id="vv_visitor_1", session_id=bad)


# ======================================================================
# GoalCreate / GoalUpdate — SDK-reported goal bounds
# ======================================================================


class TestGoalCreate:
    def test_minimal_ok(self):
        goal = GoalCreate(type="signup", label="Sign Up")
        assert goal.type == "signup"
        assert goal.confidence is None

    def test_boundary_lengths_ok(self):
        goal = GoalCreate(type="t" * 100, label="l" * 255)
        assert len(goal.type) == 100
        assert len(goal.label) == 255

    @pytest.mark.parametrize("kwargs", [{"type": ""}, {"label": ""}])
    def test_empty_rejected(self, kwargs):
        base = {"type": "signup", "label": "Sign Up"}
        base.update(kwargs)
        with pytest.raises(ValidationError):
            GoalCreate(**base)

    def test_oversized_type_rejected(self):
        # type maps to String(100).
        with pytest.raises(ValidationError):
            GoalCreate(type="t" * 101, label="Sign Up")

    def test_oversized_label_rejected(self):
        # label maps to String(255).
        with pytest.raises(ValidationError):
            GoalCreate(type="signup", label="l" * 256)


class TestGoalUpdate:
    def test_empty_update_is_noop(self):
        assert GoalUpdate().model_dump(exclude_unset=True) == {}

    def test_confirm_only(self):
        assert GoalUpdate(confirmed=True).model_dump(exclude_unset=True) == {"confirmed": True}

    def test_relabel_ok(self):
        assert GoalUpdate(label="Renamed").label == "Renamed"

    @pytest.mark.parametrize("bad", ["", "l" * 256])
    def test_invalid_label_rejected(self, bad):
        with pytest.raises(ValidationError):
            GoalUpdate(label=bad)
