from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.experiment import Experiment
from app.stats.bayesian import BetaBinomial
from app.stats.decisions import expected_loss, generate_recommendation
from app.stats.proxy import ProxyMetrics


class StatsEngine:
    """Orchestrates Bayesian analysis for an experiment."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def analyze_experiment(self, experiment: Experiment) -> dict:
        """Run full statistical analysis on an experiment and return results dict."""
        variant_keys = experiment.variant_keys
        variant_data: dict[str, dict] = {}

        for variant_key in variant_keys:
            # Count unique visitors assigned to this variant
            visitors_q = (
                select(func.count(func.distinct(Event.visitor_id)))
                .where(
                    Event.project_id == experiment.project_id,
                    Event.experiment_assignments[experiment.key].astext == variant_key,
                )
            )
            visitors_result = await self.db.execute(visitors_q)
            visitors = visitors_result.scalar() or 0

            # Count conversions (event_type = 'conversion')
            conversions_q = (
                select(func.count())
                .select_from(Event)
                .where(
                    Event.project_id == experiment.project_id,
                    Event.experiment_assignments[experiment.key].astext == variant_key,
                    Event.event_type == "conversion",
                )
            )
            conversions_result = await self.db.execute(conversions_q)
            conversions = conversions_result.scalar() or 0

            # Bayesian analysis
            model = BetaBinomial()
            model.update(conversions, visitors)

            # Proxy engagement metrics
            proxy = ProxyMetrics()
            engagement_score = await proxy.compute_engagement_score(
                self.db, experiment.project_id, experiment.key, variant_key
            )

            variant_data[variant_key] = {
                "variant_key": variant_key,
                "visitors": visitors,
                "conversions": conversions,
                "conversion_rate": conversions / visitors if visitors > 0 else 0.0,
                "posterior_mean": model.posterior_mean(),
                "credible_interval": model.credible_interval(),
                "engagement_score": engagement_score,
            }

        # Head-to-head comparison (first two variants)
        prob_b_beats_a = None
        exp_loss = None
        recommendation = None
        if len(variant_keys) >= 2:
            a_data = variant_data[variant_keys[0]]
            b_data = variant_data[variant_keys[1]]

            model_a = BetaBinomial()
            model_a.update(a_data["conversions"], a_data["visitors"])
            model_b = BetaBinomial()
            model_b.update(b_data["conversions"], b_data["visitors"])

            prob_b_beats_a = BetaBinomial.probability_b_beats_a(model_a, model_b)
            exp_loss = expected_loss(model_a, model_b)
            recommendation = generate_recommendation(
                prob_b_beats_a=prob_b_beats_a,
                expected_loss=exp_loss,
                visitors_a=a_data["visitors"],
                visitors_b=b_data["visitors"],
            )

        return {
            "experiment_id": experiment.id,
            "experiment_key": experiment.key,
            "total_visitors": sum(v["visitors"] for v in variant_data.values()),
            "variants": list(variant_data.values()),
            "probability_b_beats_a": prob_b_beats_a,
            "expected_loss": exp_loss,
            "recommendation": recommendation,
        }
