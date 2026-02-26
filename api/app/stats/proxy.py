"""Proxy engagement metrics for when conversion data is sparse.

When an experiment has too few conversions to draw meaningful Bayesian
conclusions (e.g. 1 vs 0), engagement signals serve as leading indicators.
The composite score combines scroll depth, time on page, click interactions,
and form engagement into a single 0-1 metric.
"""

from __future__ import annotations

from typing import Any


class ProxyMetrics:
    """Compute and compare engagement proxy metrics across variants.

    The composite engagement score is a weighted combination of four
    behavioural signals, each normalized to [0, 1]:

    - **Scroll depth** (weight 0.3): max scroll depth 0-100 mapped to 0-1
    - **Time on page** (weight 0.2): active time in seconds, capped at 300s
    - **Click interactions** (weight 0.2): click count, capped at 20
    - **Form engagement** (weight 0.3): binary -- did user interact with a form?
    """

    WEIGHTS = {
        "scroll_depth": 0.3,
        "time_on_page": 0.2,
        "click_count": 0.2,
        "form_engagement": 0.3,
    }

    # Caps for normalization
    MAX_TIME_ON_PAGE = 300.0  # seconds
    MAX_CLICK_COUNT = 20
    MAX_SCROLL_DEPTH = 100.0  # percentage 0-100

    # ------------------------------------------------------------------
    # Core scoring
    # ------------------------------------------------------------------

    @classmethod
    def compute_engagement_score(cls, events: list[dict[str, Any]]) -> float:
        """Compute a composite engagement score from a list of event dicts.

        Each event dict is expected to have an ``event_type`` and a
        ``payload`` dict.  The method extracts signals from the following
        event types:

        - ``scroll``: payload.max_depth (0-100)
        - ``page_view`` / ``heartbeat``: payload.active_time (seconds)
        - ``click``: counted
        - ``form_interaction`` / ``form_submit``: presence triggers binary flag

        Parameters
        ----------
        events : list[dict]
            Raw event dicts for a single variant's visitors.

        Returns
        -------
        float
            Composite score in [0, 1].  Returns 0.0 if events is empty.
        """
        if not events:
            return 0.0

        max_scroll_depth = 0.0
        max_active_time = 0.0
        click_count = 0
        has_form_engagement = False

        for event in events:
            event_type = event.get("event_type", "")
            payload = event.get("payload") or {}

            if event_type == "scroll":
                # SDK sends camelCase maxDepth; also accept snake_case max_depth
                depth = payload.get("maxDepth", payload.get("max_depth", payload.get("depth", 0)))
                try:
                    max_scroll_depth = max(max_scroll_depth, float(depth))
                except (TypeError, ValueError):
                    pass

            elif event_type in ("page_view", "heartbeat", "engagement"):
                # SDK engagement events send activeTimeMs (milliseconds);
                # page_view/heartbeat may send active_time (seconds)
                active_time_ms = payload.get("activeTimeMs", 0)
                if active_time_ms:
                    try:
                        active_time = float(active_time_ms) / 1000.0
                    except (TypeError, ValueError):
                        active_time = 0.0
                else:
                    active_time = payload.get("active_time", payload.get("time_on_page", 0))
                    try:
                        active_time = float(active_time)
                    except (TypeError, ValueError):
                        active_time = 0.0
                max_active_time = max(max_active_time, active_time)

            elif event_type == "click":
                click_count += 1

            elif event_type in ("form_interaction", "form_submit"):
                has_form_engagement = True

        # Normalize each signal to [0, 1]
        scroll_score = min(max_scroll_depth / cls.MAX_SCROLL_DEPTH, 1.0)
        time_score = min(max_active_time / cls.MAX_TIME_ON_PAGE, 1.0)
        click_score = min(click_count / cls.MAX_CLICK_COUNT, 1.0)
        form_score = 1.0 if has_form_engagement else 0.0

        # Weighted composite
        score = (
            cls.WEIGHTS["scroll_depth"] * scroll_score
            + cls.WEIGHTS["time_on_page"] * time_score
            + cls.WEIGHTS["click_count"] * click_score
            + cls.WEIGHTS["form_engagement"] * form_score
        )
        return round(score, 4)

    # ------------------------------------------------------------------
    # Variant comparison
    # ------------------------------------------------------------------

    @staticmethod
    def compare_variants(
        variant_scores: dict[str, list[float]],
    ) -> dict[str, Any]:
        """Compare engagement scores across variants.

        Parameters
        ----------
        variant_scores : dict[str, list[float]]
            Maps variant key -> list of per-visitor engagement scores.

        Returns
        -------
        dict
            Contains per-variant means, pairwise differences, and a
            plain-English summary.
        """
        means: dict[str, float] = {}
        for key, scores in variant_scores.items():
            means[key] = sum(scores) / len(scores) if scores else 0.0

        # Build pairwise differences
        keys = list(means.keys())
        differences: dict[str, float] = {}
        for i, k1 in enumerate(keys):
            for k2 in keys[i + 1 :]:
                diff = means[k2] - means[k1]
                differences[f"{k2}_vs_{k1}"] = round(diff, 4)

        # Plain-English summary
        if len(keys) < 2:
            summary = "Need at least two variants to compare engagement."
        else:
            best_key = max(means, key=means.get)  # type: ignore[arg-type]
            worst_key = min(means, key=means.get)  # type: ignore[arg-type]
            gap = means[best_key] - means[worst_key]

            if gap < 0.05:
                summary = (
                    "Engagement is similar between variants. "
                    "Need more data to differentiate."
                )
            else:
                pct = (gap / max(means[worst_key], 0.001)) * 100
                summary = (
                    f"Variant {best_key} shows {pct:.0f}% higher engagement "
                    f"than {worst_key} ({means[best_key]:.3f} vs {means[worst_key]:.3f})."
                )

        return {
            "means": means,
            "differences": differences,
            "summary": summary,
        }

    # ------------------------------------------------------------------
    # Data sufficiency check
    # ------------------------------------------------------------------

    @staticmethod
    def has_sufficient_conversion_data(
        conversions_per_variant: dict[str, int],
        min_conversions: int = 3,
    ) -> bool:
        """Check whether we have enough conversions across variants.

        Returns True only if *every* variant has at least ``min_conversions``.
        When this returns False, the engine should lean on proxy metrics
        instead of raw conversion comparison.

        Parameters
        ----------
        conversions_per_variant : dict[str, int]
            Maps variant key -> total conversion count.
        min_conversions : int
            Minimum conversions per variant.

        Returns
        -------
        bool
        """
        if not conversions_per_variant:
            return False
        return all(c >= min_conversions for c in conversions_per_variant.values())
