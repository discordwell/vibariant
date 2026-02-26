"""StatsEngine — orchestrator that ties together Bayesian models, bandits,
proxy metrics, priors, shrinkage, and recommendation generation into a single
``analyze_experiment`` call.

This is the main entry point for the stats router and the dashboard.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import numpy as np
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.experiment import Experiment
from app.models.goal import Goal
from app.stats.bandits import TopTwoThompsonSampler
from app.stats.bayesian import BetaBinomial
from app.stats.decisions import expected_loss, generate_recommendation
from app.stats.priors import resolve_prior
from app.stats.proxy import ProxyMetrics
from app.stats.shrinkage import shrink_current_effect


class StatsEngine:
    """Orchestrates full Bayesian analysis for an experiment.

    Parameters
    ----------
    db : AsyncSession
        SQLAlchemy async session for querying events.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def analyze_experiment(self, experiment: Experiment) -> dict[str, Any]:
        """Run full statistical analysis on an experiment.

        Steps:
        1. Resolve prior (user-elicited > project historical > platform default)
        2. Query events grouped by variant
        3. Count visitors and conversions per variant
        4. Build BetaBinomial models per variant
        5. Compute probability of each variant being best
        6. Compute expected loss
        7. If conversions are sparse, compute proxy metrics from engagement events
        8. Run Top-Two Thompson Sampling to get recommended traffic allocation
        9. Generate structured recommendation with epsilon stopping + ROPE
        10. Compute shrinkage-adjusted effect size
        11. Return complete results dict

        Parameters
        ----------
        experiment : Experiment
            The experiment model instance.

        Returns
        -------
        dict
            Complete analysis results.
        """
        variant_keys: list[str] = experiment.variant_keys
        experiment_key: str = experiment.key
        project_id: UUID = experiment.project_id

        # ----------------------------------------------------------
        # 1. Resolve prior
        # ----------------------------------------------------------
        prior, prior_used = await resolve_prior(
            self.db,
            project_id,
            getattr(experiment, "expected_conversion_rate", None),
            getattr(experiment, "prior_confidence", None),
        )

        # ----------------------------------------------------------
        # 2 & 3. Query visitors and conversions per variant
        # ----------------------------------------------------------
        variant_data: list[dict[str, Any]] = []
        models: list[BetaBinomial] = []
        conversions_per_variant: dict[str, int] = {}

        for variant_key in variant_keys:
            visitors = await self._count_visitors(
                project_id, experiment_key, variant_key
            )
            conversions = await self._count_conversions(
                project_id, experiment_key, variant_key
            )
            conversions_per_variant[variant_key] = conversions

            # 4. Build BetaBinomial model with resolved prior
            model = prior.update(conversions, visitors)
            models.append(model)

            conversion_rate = conversions / visitors if visitors > 0 else 0.0

            variant_data.append(
                {
                    "variant_key": variant_key,
                    "visitors": visitors,
                    "conversions": conversions,
                    "conversion_rate": round(conversion_rate, 6),
                    "posterior_mean": round(model.posterior_mean(), 6),
                    "credible_interval": tuple(
                        round(x, 6) for x in model.credible_interval()
                    ),
                    "engagement_score": None,  # filled below if needed
                }
            )

        total_visitors = sum(v["visitors"] for v in variant_data)

        # ----------------------------------------------------------
        # 5. Probability of each variant being best
        # ----------------------------------------------------------
        prob_best: list[float] | None = None
        prob_b_beats_a: float | None = None

        if len(models) == 2:
            prob_b_beats_a = BetaBinomial.probability_b_beats_a(models[0], models[1])
            prob_best = [round(1 - prob_b_beats_a, 4), round(prob_b_beats_a, 4)]
        elif len(models) > 2:
            prob_best = [round(p, 4) for p in BetaBinomial.probability_best(models)]

        # ----------------------------------------------------------
        # 6. Expected loss
        # ----------------------------------------------------------
        exp_loss: list[float] | None = None
        if len(models) >= 2:
            exp_loss = [round(x, 6) for x in expected_loss(models)]

        # ----------------------------------------------------------
        # 7. Proxy metrics if conversions are sparse
        # ----------------------------------------------------------
        has_enough_conversions = ProxyMetrics.has_sufficient_conversion_data(
            conversions_per_variant, min_conversions=3
        )
        engagement_comparison: dict[str, Any] | None = None

        if not has_enough_conversions:
            variant_scores: dict[str, list[float]] = {}
            for i, variant_key in enumerate(variant_keys):
                events = await self._get_engagement_events(
                    project_id, experiment_key, variant_key
                )
                if events:
                    # Score per visitor: group events by visitor_id
                    visitor_events: dict[str, list[dict]] = {}
                    for ev in events:
                        vid = ev["visitor_id"]
                        if vid not in visitor_events:
                            visitor_events[vid] = []
                        visitor_events[vid].append(ev)

                    scores = [
                        ProxyMetrics.compute_engagement_score(vevents)
                        for vevents in visitor_events.values()
                    ]

                    # Apply winsorization to cap outliers
                    scores = ProxyMetrics.winsorize_scores(scores, percentile=95.0)

                    variant_scores[variant_key] = scores

                    # Set mean engagement score on variant data
                    mean_score = sum(scores) / len(scores) if scores else 0.0
                    variant_data[i]["engagement_score"] = round(mean_score, 4)
                else:
                    variant_scores[variant_key] = []

            if any(len(s) > 0 for s in variant_scores.values()):
                engagement_comparison = ProxyMetrics.compare_variants(variant_scores)

        # ----------------------------------------------------------
        # 8. Top-Two Thompson Sampling traffic allocation
        # ----------------------------------------------------------
        suggested_allocation: dict[str, float] | None = None
        if len(models) >= 2:
            sampler = TopTwoThompsonSampler(models, min_allocation=0.10)
            raw_alloc = sampler.get_allocation(n_samples=10_000)
            suggested_allocation = {
                variant_keys[i]: round(raw_alloc[i], 4)
                for i in range(len(variant_keys))
            }

        # ----------------------------------------------------------
        # 9. Generate structured recommendation
        # ----------------------------------------------------------
        loss_threshold = getattr(experiment, "loss_threshold", 0.005)
        rope_width = getattr(experiment, "rope_width", 0.005)

        recommendation_input: dict[str, Any] = {
            "variants": variant_data,
            "probability_best": prob_best,
            "probability_b_beats_a": prob_b_beats_a,
            "expected_loss": exp_loss,
            "engagement_comparison": engagement_comparison,
            "models": models,
        }
        decision = generate_recommendation(
            recommendation_input,
            loss_threshold=loss_threshold,
            rope_width=rope_width,
        )

        # ----------------------------------------------------------
        # 10. Shrinkage-adjusted effect size
        # ----------------------------------------------------------
        raw_effect_size: float | None = None
        shrunk_effect_size: float | None = None

        if len(variant_data) >= 2:
            means = [v["posterior_mean"] for v in variant_data]
            raw_effect_size = max(means) - min(means)

            # Standard error approximation
            total_conv = sum(v["conversions"] for v in variant_data)
            total_vis = sum(v["visitors"] for v in variant_data)
            if total_vis > 0 and total_conv > 0:
                p_hat = total_conv / total_vis
                se = math.sqrt(p_hat * (1 - p_hat) / total_vis) if p_hat < 1 else 0.01
                shrunk = await shrink_current_effect(
                    self.db, project_id, raw_effect_size, se
                )
                shrunk_effect_size = round(shrunk, 6) if shrunk is not None else None

        # ----------------------------------------------------------
        # 11. Compute decision progress
        # ----------------------------------------------------------
        decision_progress: dict[str, Any] | None = None
        if exp_loss is not None and len(exp_loss) >= 2:
            leading_loss = min(exp_loss)
            confidence_pct = min(100.0, (1.0 - leading_loss / max(loss_threshold, 1e-10)) * 100)
            confidence_pct = max(0.0, confidence_pct)

            # Estimate days to decision based on daily visitor rate
            daily_rate: float | None = None
            estimated_days: float | None = None
            if total_visitors > 0 and experiment.created_at:
                now = datetime.now(timezone.utc)
                created = experiment.created_at
                if created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                else:
                    created = created.astimezone(timezone.utc)
                days_running = max((now - created).total_seconds() / 86400, 0.1)
                daily_rate = total_visitors / days_running
                if daily_rate > 0 and confidence_pct < 100:
                    # Rough heuristic: linear extrapolation
                    remaining_pct = 100 - confidence_pct
                    estimated_days = round((remaining_pct / max(confidence_pct, 1)) * days_running, 1)

            decision_progress = {
                "confidence_pct": round(confidence_pct, 1),
                "epsilon_threshold": loss_threshold,
                "leading_variant_loss": round(leading_loss, 6),
                "estimated_days": estimated_days,
                "daily_visitor_rate": round(daily_rate, 1) if daily_rate else None,
            }

        # ----------------------------------------------------------
        # 12. Assemble results
        # ----------------------------------------------------------
        # Keep backward-compat recommendation string
        recommendation_str = decision.get("recommendation", "")

        return {
            "experiment_id": experiment.id,
            "experiment_key": experiment_key,
            "total_visitors": total_visitors,
            "variants": variant_data,
            "probability_b_beats_a": prob_b_beats_a,
            "probability_best": prob_best,
            "expected_loss": (
                {variant_keys[i]: exp_loss[i] for i in range(len(variant_keys))}
                if exp_loss
                else None
            ),
            "recommendation": recommendation_str,
            "suggested_allocation": suggested_allocation,
            "engagement_comparison": engagement_comparison,
            # v2 fields
            "decision": {
                "decision_status": decision.get("decision_status", "collecting_data"),
                "winning_variant": decision.get("winning_variant"),
                "confidence_level": decision.get("confidence_level"),
            },
            "rope_analysis": decision.get("rope_analysis"),
            "decision_progress": decision_progress,
            "prior_used": prior_used,
            "raw_effect_size": round(raw_effect_size, 6) if raw_effect_size is not None else None,
            "shrunk_effect_size": shrunk_effect_size,
        }

    # ------------------------------------------------------------------
    # Private query helpers
    # ------------------------------------------------------------------

    async def _count_visitors(
        self, project_id: UUID, experiment_key: str, variant_key: str
    ) -> int:
        """Count unique visitors assigned to a variant."""
        result = await self.db.execute(
            select(func.count(func.distinct(Event.visitor_id))).where(
                Event.project_id == project_id,
                Event.experiment_assignments[experiment_key].astext == variant_key,
            )
        )
        return result.scalar() or 0

    async def _count_conversions(
        self, project_id: UUID, experiment_key: str, variant_key: str
    ) -> int:
        """Count conversion events for a variant.

        Explicit ``conversion`` events are always counted.  ``goal_completed``
        events are only counted when the goal type has been confirmed by the
        user in the dashboard, to avoid inflating stats with false-positive
        auto-detected goals.
        """
        # Count explicit conversion events (always trusted)
        explicit_result = await self.db.execute(
            select(func.count())
            .select_from(Event)
            .where(
                Event.project_id == project_id,
                Event.experiment_assignments[experiment_key].astext == variant_key,
                Event.event_type == "conversion",
            )
        )
        explicit_count = explicit_result.scalar() or 0

        # Get confirmed goal types for this project
        confirmed_types_result = await self.db.execute(
            select(Goal.type).where(
                Goal.project_id == project_id,
                Goal.confirmed.is_(True),
            )
        )
        confirmed_types = {row[0] for row in confirmed_types_result.all()}

        # Count goal_completed events only for confirmed goal types
        goal_count = 0
        if confirmed_types:
            goal_result = await self.db.execute(
                select(func.count())
                .select_from(Event)
                .where(
                    Event.project_id == project_id,
                    Event.experiment_assignments[experiment_key].astext == variant_key,
                    Event.event_type == "goal_completed",
                    Event.payload["goalType"].astext.in_(confirmed_types),
                )
            )
            goal_count = goal_result.scalar() or 0

        return explicit_count + goal_count

    async def _get_engagement_events(
        self, project_id: UUID, experiment_key: str, variant_key: str
    ) -> list[dict[str, Any]]:
        """Fetch engagement events for proxy metric computation."""
        result = await self.db.execute(
            select(
                Event.visitor_id,
                Event.event_type,
                Event.payload,
            ).where(
                Event.project_id == project_id,
                Event.experiment_assignments[experiment_key].astext == variant_key,
                Event.event_type.in_(
                    ["scroll", "click", "form_interaction", "form_submit", "page_view", "heartbeat", "engagement"]
                ),
            )
        )
        rows = result.all()
        return [
            {
                "visitor_id": row.visitor_id,
                "event_type": row.event_type,
                "payload": row.payload or {},
            }
            for row in rows
        ]
