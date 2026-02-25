from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event


class ProxyMetrics:
    """Engagement proxy metrics for when conversion data is sparse.

    Computes a composite engagement score from behavioral signals:
    scroll depth, time on page, click count, form interactions.
    """

    # Weights for composite score (tuned for vibecoded app patterns)
    WEIGHTS = {
        "scroll_depth": 0.25,
        "time_on_page": 0.25,
        "click_count": 0.25,
        "form_engagement": 0.25,
    }

    async def compute_engagement_score(
        self,
        db: AsyncSession,
        project_id: UUID,
        experiment_key: str,
        variant_key: str,
    ) -> float | None:
        """Compute a normalized 0-1 engagement score for a variant.

        Returns None if insufficient data is available.
        """
        # Count engagement events for this variant
        result = await db.execute(
            select(func.count())
            .select_from(Event)
            .where(
                Event.project_id == project_id,
                Event.experiment_assignments[experiment_key].astext == variant_key,
                Event.event_type.in_(["scroll", "click", "form_interaction", "page_view"]),
            )
        )
        event_count = result.scalar() or 0

        # Count unique visitors in this variant
        visitor_result = await db.execute(
            select(func.count(func.distinct(Event.visitor_id))).where(
                Event.project_id == project_id,
                Event.experiment_assignments[experiment_key].astext == variant_key,
            )
        )
        visitor_count = visitor_result.scalar() or 0

        if visitor_count == 0:
            return None

        # Simple engagement rate: events per visitor, normalized to 0-1
        # Cap at 20 events/visitor as "max engagement"
        raw_score = min(event_count / visitor_count / 20.0, 1.0)
        return round(raw_score, 4)

    @staticmethod
    def compare_variants(score_a: float | None, score_b: float | None) -> str:
        """Generate a plain-English comparison of two variant engagement scores."""
        if score_a is None or score_b is None:
            return "Insufficient engagement data to compare variants."

        diff = score_b - score_a
        if abs(diff) < 0.05:
            return "Engagement is similar between variants. Need more data to differentiate."
        elif diff > 0:
            pct = diff / max(score_a, 0.001) * 100
            return f"Variant B shows {pct:.0f}% higher engagement than control."
        else:
            pct = abs(diff) / max(score_b, 0.001) * 100
            return f"Control shows {pct:.0f}% higher engagement than Variant B."
