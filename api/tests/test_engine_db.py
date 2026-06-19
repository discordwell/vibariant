"""Real-PostgreSQL tests for the StatsEngine query layer.

``test_engine.py`` exercises the ``analyze_experiment`` *orchestration* but
mocks out the four DB-backed helpers, so the actual SQL — which relies on
PostgreSQL-specific JSONB operators — is never executed there. That SQL is
exactly where the last production 500 lived (``conversions`` counted as raw
*events* instead of distinct *visitors*, which let ``conversions > visitors``
crash ``BetaBinomial.update``). These tests close that gap by running the real
queries against a live Postgres.

Isolation & safety
------------------
* Every test runs inside a single transaction that is **always rolled back** —
  nothing is ever committed, so the target database is left untouched.
* All data is scoped to a fresh random ``project_id`` per test, so the queries
  can never observe (or be polluted by) pre-existing rows.
* Schema is materialised with ``Base.metadata.create_all`` (idempotent against
  an already-migrated dev database).

The whole module **skips** when no database is reachable, matching the repo's
existing two-tier topology (pure-logic tests vs. infra-backed tests). Point it
at a throwaway database with ``TEST_DATABASE_URL`` if you prefer.

Async is driven via ``asyncio.run`` in synchronous test functions, the same
convention used by ``test_engine.py`` and the integration suite (no
pytest-asyncio configuration exists in this project).
"""

import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.security import generate_api_key, generate_project_token  # noqa: E402
from app.models import Event, Goal, Project, User  # noqa: E402
from app.models.base import Base  # noqa: E402
from app.stats.engine import StatsEngine  # noqa: E402

DB_URL = os.environ.get("TEST_DATABASE_URL", settings.DATABASE_URL)
_TS = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)


# ----------------------------------------------------------------------
# Availability probe + one-time schema creation (skip module if no DB)
# ----------------------------------------------------------------------


async def _probe_and_prepare() -> bool:
    engine = create_async_engine(DB_URL)
    try:
        async with engine.begin() as conn:
            # Idempotent: a no-op against an already-migrated database.
            await conn.run_sync(Base.metadata.create_all)
        return True
    except Exception:
        return False
    finally:
        await engine.dispose()


try:
    _DB_READY = asyncio.run(_probe_and_prepare())
except Exception:
    _DB_READY = False

pytestmark = pytest.mark.skipif(
    not _DB_READY,
    reason=f"No PostgreSQL reachable at {DB_URL!r}; engine query tests skipped",
)


# ----------------------------------------------------------------------
# Per-test harness: seed → assert → rollback
# ----------------------------------------------------------------------


class _Ctx:
    """A seeded, isolated experiment fixture bound to one rolled-back txn."""

    def __init__(self, db) -> None:
        self.db = db
        self.project_id = uuid.uuid4()
        self.experiment_key = "exp"
        self.engine = StatsEngine(db)

    async def _init_project(self) -> None:
        uid = uuid.uuid4()
        self.db.add(User(id=uid, email=f"u-{uid}@test.local", name="t"))
        self.db.add(
            Project(
                id=self.project_id,
                name="test",
                user_id=uid,
                project_token=generate_project_token(),
                api_key=generate_api_key(),
            )
        )
        await self.db.flush()

    def add_event(
        self,
        visitor_id: str,
        variant: str | None,
        event_type: str,
        payload: dict | None = None,
        *,
        experiment_key: str | None = None,
        project_id: uuid.UUID | None = None,
    ) -> None:
        """Queue an event. ``variant`` becomes ``{experiment_key: variant}``
        in ``experiment_assignments`` (set ``variant=None`` for an unassigned
        event)."""
        ek = experiment_key or self.experiment_key
        assignments = {ek: variant} if variant is not None else None
        self.db.add(
            Event(
                project_id=project_id or self.project_id,
                visitor_id=visitor_id,
                session_id="s",
                experiment_assignments=assignments,
                event_type=event_type,
                payload=payload,
                timestamp=_TS,
            )
        )

    def add_goal(self, goal_type: str, *, confirmed: bool = True) -> None:
        self.db.add(
            Goal(
                project_id=self.project_id,
                type=goal_type,
                label=goal_type,
                confirmed=confirmed,
            )
        )

    async def add_foreign_project(self) -> uuid.UUID:
        """Create a second project (with its own user) and return its id, for
        cross-project isolation checks."""
        uid = uuid.uuid4()
        pid = uuid.uuid4()
        self.db.add(User(id=uid, email=f"u-{uid}@test.local", name="f"))
        self.db.add(
            Project(
                id=pid,
                name="foreign",
                user_id=uid,
                project_token=generate_project_token(),
                api_key=generate_api_key(),
            )
        )
        await self.db.flush()
        return pid

    async def flush(self) -> None:
        await self.db.flush()

    async def counts(self, variant: str) -> tuple[int, int]:
        """Return (visitors, conversions) for a variant via the real queries."""
        confirmed = await self.engine._get_confirmed_goal_types(self.project_id)
        visitors = await self.engine._count_visitors(
            self.project_id, self.experiment_key, variant
        )
        conversions = await self.engine._count_conversions(
            self.project_id, self.experiment_key, variant, confirmed
        )
        return visitors, conversions


async def _drive(body):
    engine = create_async_engine(DB_URL)
    try:
        async with engine.connect() as conn:
            trans = await conn.begin()
            session_factory = async_sessionmaker(bind=conn, expire_on_commit=False)
            async with session_factory() as db:
                ctx = _Ctx(db)
                await ctx._init_project()
                result = await body(ctx)
            await trans.rollback()  # nothing persists, ever
        return result
    finally:
        await engine.dispose()


def run(body):
    """Run an ``async def body(ctx)`` scenario in an isolated rolled-back txn."""
    return asyncio.run(_drive(body))


# ----------------------------------------------------------------------
# _count_visitors — distinct visitors, not events
# ----------------------------------------------------------------------


def test_visitors_counts_distinct_not_events():
    async def body(ctx):
        # One visitor firing five events is still one visitor.
        for _ in range(5):
            ctx.add_event("v1", "control", "page_view")
        ctx.add_event("v2", "control", "page_view")
        await ctx.flush()
        return await ctx.counts("control")

    visitors, conversions = run(body)
    assert visitors == 2
    assert conversions == 0


def test_visitors_isolated_per_variant():
    async def body(ctx):
        ctx.add_event("v1", "control", "page_view")
        ctx.add_event("v2", "control", "page_view")
        ctx.add_event("v3", "variant", "page_view")
        await ctx.flush()
        return await ctx.counts("control"), await ctx.counts("variant")

    control, variant = run(body)
    assert control[0] == 2
    assert variant[0] == 1


# ----------------------------------------------------------------------
# _count_conversions — distinct converters, the production regression
# ----------------------------------------------------------------------


def test_repeat_converter_counts_once():
    """The exact 500 regression: a visitor who fires two ``goal_completed``
    events for a confirmed goal must count as ONE conversion, never two."""

    async def body(ctx):
        ctx.add_goal("signup", confirmed=True)
        ctx.add_event("v1", "control", "page_view")
        ctx.add_event("v1", "control", "goal_completed", {"goalType": "signup"})
        ctx.add_event("v1", "control", "goal_completed", {"goalType": "signup"})
        ctx.add_event("v2", "control", "page_view")
        await ctx.flush()
        return await ctx.counts("control")

    visitors, conversions = run(body)
    assert visitors == 2
    assert conversions == 1  # distinct converter, not 2 events
    assert conversions <= visitors  # invariant holds structurally


def test_explicit_conversion_event_counts_without_confirmed_goals():
    """An explicit ``conversion`` event always counts, even with no goals."""

    async def body(ctx):
        ctx.add_event("v1", "control", "page_view")
        ctx.add_event("v1", "control", "conversion")
        ctx.add_event("v2", "control", "page_view")
        await ctx.flush()
        return await ctx.counts("control")

    visitors, conversions = run(body)
    assert (visitors, conversions) == (2, 1)


def test_unconfirmed_goal_does_not_count_as_conversion():
    """``goal_completed`` for an *unconfirmed* goal type is excluded — this is
    what keeps auto-detected false positives out of the conversion rate."""

    async def body(ctx):
        ctx.add_goal("rage_click", confirmed=False)
        ctx.add_event("v1", "control", "page_view")
        ctx.add_event("v1", "control", "goal_completed", {"goalType": "rage_click"})
        await ctx.flush()
        return await ctx.counts("control")

    visitors, conversions = run(body)
    assert visitors == 1
    assert conversions == 0


def test_only_confirmed_goal_types_count():
    async def body(ctx):
        ctx.add_goal("signup", confirmed=True)
        ctx.add_goal("newsletter", confirmed=False)
        # v1 converts on a confirmed goal, v2 only on an unconfirmed one.
        ctx.add_event("v1", "control", "goal_completed", {"goalType": "signup"})
        ctx.add_event("v2", "control", "goal_completed", {"goalType": "newsletter"})
        await ctx.flush()
        return await ctx.counts("control")

    visitors, conversions = run(body)
    assert visitors == 2
    assert conversions == 1  # only v1


def test_conversion_and_goal_event_for_same_visitor_counts_once():
    """A visitor with BOTH an explicit ``conversion`` and a confirmed
    ``goal_completed`` is still a single distinct converter."""

    async def body(ctx):
        ctx.add_goal("signup", confirmed=True)
        ctx.add_event("v1", "control", "conversion")
        ctx.add_event("v1", "control", "goal_completed", {"goalType": "signup"})
        await ctx.flush()
        return await ctx.counts("control")

    visitors, conversions = run(body)
    assert conversions == 1


# ----------------------------------------------------------------------
# Isolation: experiment key, project, and assignment value matching
# ----------------------------------------------------------------------


def test_conversion_must_carry_matching_assignment():
    """A conversion event without this experiment's assignment is not counted
    against the variant — counting keys off ``experiment_assignments``."""

    async def body(ctx):
        ctx.add_event("v1", "control", "page_view")
        # Conversion carries an assignment for a *different* experiment only.
        ctx.add_event(
            "v1", "control", "conversion", experiment_key="other_exp"
        )
        await ctx.flush()
        return await ctx.counts("control")

    visitors, conversions = run(body)
    assert visitors == 1
    assert conversions == 0  # conversion lacked the matching exp assignment


def test_null_and_foreign_key_assignments_excluded():
    """The public ``/events`` endpoint accepts events with no
    ``experiment_assignments`` (or assignments for *other* experiments). The
    JSONB key lookup must treat both as "not in this experiment" rather than
    erroring or miscounting."""

    async def body(ctx):
        ctx.add_event("v1", "control", "page_view")  # genuinely in the experiment
        ctx.add_event("v2", None, "page_view")  # experiment_assignments IS NULL
        # v3 is assigned only under a *different* experiment key, never "exp".
        ctx.add_event("v3", "control", "page_view", experiment_key="some_other_exp")
        await ctx.flush()
        return await ctx.counts("control")

    visitors, conversions = run(body)
    assert visitors == 1  # only v1 is assigned to this experiment's control
    assert conversions == 0


def test_other_project_events_are_excluded():
    async def body(ctx):
        ctx.add_event("v1", "control", "page_view")
        ctx.add_event("v1", "control", "conversion")
        # Same visitor id / assignment but a foreign project_id.
        foreign = await ctx.add_foreign_project()
        ctx.add_event("v1", "control", "conversion", project_id=foreign)
        ctx.add_event("v2", "control", "page_view", project_id=foreign)
        await ctx.flush()
        return await ctx.counts("control")

    visitors, conversions = run(body)
    assert visitors == 1  # only this project's visitor
    assert conversions == 1


# ----------------------------------------------------------------------
# _get_confirmed_goal_types
# ----------------------------------------------------------------------


def test_confirmed_goal_types_returns_only_confirmed():
    async def body(ctx):
        ctx.add_goal("signup", confirmed=True)
        ctx.add_goal("purchase", confirmed=True)
        ctx.add_goal("scroll_bottom", confirmed=False)
        await ctx.flush()
        return await ctx.engine._get_confirmed_goal_types(ctx.project_id)

    confirmed = run(body)
    assert confirmed == {"signup", "purchase"}


# ----------------------------------------------------------------------
# _get_engagement_events
# ----------------------------------------------------------------------


def test_engagement_events_fetched_with_payload():
    async def body(ctx):
        ctx.add_event("v1", "control", "scroll", {"maxDepth": 80})
        ctx.add_event("v1", "control", "click")
        ctx.add_event("v1", "control", "engagement", {"activeTimeMs": 30000})
        # Non-engagement event types and conversions are not engagement signals.
        ctx.add_event("v1", "control", "conversion")
        await ctx.flush()
        return await ctx.engine._get_engagement_events(
            ctx.project_id, ctx.experiment_key, "control"
        )

    events = run(body)
    types = sorted(e["event_type"] for e in events)
    assert types == ["click", "engagement", "scroll"]
    scroll = next(e for e in events if e["event_type"] == "scroll")
    assert scroll["payload"]["maxDepth"] == 80


# ----------------------------------------------------------------------
# End-to-end: full analyze_experiment over real SQL
# ----------------------------------------------------------------------


def test_analyze_experiment_end_to_end_real_db():
    """Drive the whole orchestration against the real database and assert the
    core invariants the stats router depends on."""

    async def body(ctx):
        ctx.add_goal("signup", confirmed=True)
        # control: 40 visitors, 4 distinct converters
        for i in range(40):
            ctx.add_event(f"c{i}", "control", "page_view")
        for i in range(4):
            ctx.add_event(f"c{i}", "control", "goal_completed", {"goalType": "signup"})
        # variant: 40 visitors, 12 distinct converters
        for i in range(40):
            ctx.add_event(f"t{i}", "variant", "page_view")
        for i in range(12):
            ctx.add_event(f"t{i}", "variant", "goal_completed", {"goalType": "signup"})
        await ctx.flush()

        experiment = _make_experiment(ctx, ["control", "variant"])
        return await ctx.engine.analyze_experiment(experiment)

    result = run(body)
    assert result["total_visitors"] == 80
    by_key = {v["variant_key"]: v for v in result["variants"]}
    assert by_key["control"]["visitors"] == 40
    assert by_key["control"]["conversions"] == 4
    assert by_key["variant"]["conversions"] == 12
    for v in result["variants"]:
        assert v["conversions"] <= v["visitors"]
        assert 0.0 <= v["conversion_rate"] <= 1.0
    # The stronger variant should carry more posterior probability.
    assert result["probability_b_beats_a"] > 0.5


def test_analyze_experiment_repeat_converters_no_500():
    """With repeat converters present, the real SQL keeps conversions ≤ visitors
    so the posterior update can never raise — the production-500 guard, but now
    proven against the actual database rather than a mock."""

    async def body(ctx):
        ctx.add_goal("signup", confirmed=True)
        # A single visitor in 'variant' fires the goal three times.
        ctx.add_event("only", "variant", "page_view")
        for _ in range(3):
            ctx.add_event("only", "variant", "goal_completed", {"goalType": "signup"})
        for i in range(20):
            ctx.add_event(f"c{i}", "control", "page_view")
        await ctx.flush()
        experiment = _make_experiment(ctx, ["control", "variant"])
        return await ctx.engine.analyze_experiment(experiment)

    result = run(body)
    by_key = {v["variant_key"]: v for v in result["variants"]}
    assert by_key["variant"]["visitors"] == 1
    assert by_key["variant"]["conversions"] == 1  # not 3
    assert by_key["variant"]["conversion_rate"] == 1.0


def test_analyze_experiment_populates_engagement_when_sparse():
    """Sparse conversions route the engine through proxy metrics, which read
    real engagement events and populate ``engagement_score``."""

    async def body(ctx):
        # No confirmed conversions → proxy path engages.
        for i in range(15):
            vid = f"c{i}"
            ctx.add_event(vid, "control", "page_view")
            ctx.add_event(vid, "control", "scroll", {"maxDepth": 30})
        for i in range(15):
            vid = f"t{i}"
            ctx.add_event(vid, "variant", "page_view")
            ctx.add_event(vid, "variant", "scroll", {"maxDepth": 90})
            ctx.add_event(vid, "variant", "click")
        await ctx.flush()
        experiment = _make_experiment(ctx, ["control", "variant"])
        return await ctx.engine.analyze_experiment(experiment)

    result = run(body)
    by_key = {v["variant_key"]: v for v in result["variants"]}
    assert by_key["control"]["engagement_score"] is not None
    assert by_key["variant"]["engagement_score"] is not None
    # The variant has deeper scroll + clicks → higher engagement.
    assert by_key["variant"]["engagement_score"] > by_key["control"]["engagement_score"]
    assert result["engagement_comparison"] is not None


def _make_experiment(ctx, variant_keys):
    """Build an Experiment row in the seeded project for end-to-end analysis."""
    from app.models.experiment import Experiment

    experiment = Experiment(
        project_id=ctx.project_id,
        key=ctx.experiment_key,
        name="e2e",
        variant_keys=variant_keys,
        traffic_percentage=1.0,
        loss_threshold=0.005,
        rope_width=0.005,
        created_at=_TS,
    )
    ctx.db.add(experiment)
    return experiment
