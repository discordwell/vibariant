"""Proxy engagement metrics for when conversion data is sparse.

When an experiment has too few conversions to draw meaningful Bayesian
conclusions (e.g. 1 vs 0), engagement signals serve as leading indicators.
The composite score combines scroll depth, time on page, click interactions,
and form engagement into a single 0-1 metric.

v2 additions:
- calibrate_weights(): OLS calibration against binary conversion outcomes
- winsorize_scores(): cap outliers at a given percentile
- cuped_adjust(): CUPED variance reduction for returning visitors
"""

from __future__ import annotations

from typing import Any

import numpy as np


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
    def compute_engagement_score(
        cls,
        events: list[dict[str, Any]],
        weights: dict[str, float] | None = None,
    ) -> float:
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

        # Weighted composite (use calibrated weights if provided)
        w = weights if weights is not None else cls.WEIGHTS
        score = (
            w.get("scroll_depth", cls.WEIGHTS["scroll_depth"]) * scroll_score
            + w.get("time_on_page", cls.WEIGHTS["time_on_page"]) * time_score
            + w.get("click_count", cls.WEIGHTS["click_count"]) * click_score
            + w.get("form_engagement", cls.WEIGHTS["form_engagement"]) * form_score
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

    # ------------------------------------------------------------------
    # Weight calibration (v2)
    # ------------------------------------------------------------------

    @staticmethod
    def calibrate_weights(
        historical_results: list[dict[str, Any]],
    ) -> dict[str, float] | None:
        """Calibrate engagement signal weights against binary conversion.

        Uses OLS regression of the 4 engagement signals against observed
        binary conversion outcomes from past experiment data.

        Parameters
        ----------
        historical_results : list[dict]
            Each dict has: scroll_depth, time_on_page, click_count,
            form_engagement (floats 0-1), and converted (bool/int).

        Returns
        -------
        dict | None
            Normalized weights summing to 1.0, or None if insufficient data.
        """
        if len(historical_results) < 10:
            return None

        try:
            X = np.array([
                [
                    r.get("scroll_depth", 0),
                    r.get("time_on_page", 0),
                    r.get("click_count", 0),
                    r.get("form_engagement", 0),
                ]
                for r in historical_results
            ])
            y = np.array([float(r.get("converted", 0)) for r in historical_results])

            # OLS: beta = (X^T X)^{-1} X^T y
            XtX = X.T @ X
            # Regularize for numerical stability
            XtX += np.eye(4) * 1e-6
            Xty = X.T @ y
            beta = np.linalg.solve(XtX, Xty)

            # Take absolute values (negative weights don't make sense for engagement)
            beta = np.abs(beta)
            total = np.sum(beta)
            if total <= 0:
                return None

            beta = beta / total
            keys = ["scroll_depth", "time_on_page", "click_count", "form_engagement"]
            return {k: round(float(v), 4) for k, v in zip(keys, beta)}
        except (np.linalg.LinAlgError, ValueError):
            return None

    # ------------------------------------------------------------------
    # Variance reduction (v2)
    # ------------------------------------------------------------------

    @staticmethod
    def winsorize_scores(scores: list[float], percentile: float = 95.0) -> list[float]:
        """Cap outlier engagement scores at the given percentile.

        Parameters
        ----------
        scores : list[float]
            Raw engagement scores.
        percentile : float
            Upper percentile to cap at (default 95th).

        Returns
        -------
        list[float]
            Winsorized scores.
        """
        if not scores:
            return []
        arr = np.array(scores)
        cap = float(np.percentile(arr, percentile))
        return np.minimum(arr, cap).tolist()

    @staticmethod
    def cuped_adjust(
        scores: list[float],
        pre_experiment_scores: list[float],
    ) -> list[float]:
        """CUPED (Controlled-experiment Using Pre-Experiment Data) adjustment.

        adjusted_Y = Y - theta * (X - mean(X))

        where theta = cov(Y, X) / var(X).

        Parameters
        ----------
        scores : list[float]
            Post-experiment engagement scores (Y).
        pre_experiment_scores : list[float]
            Pre-experiment engagement scores for the same visitors (X).

        Returns
        -------
        list[float]
            Variance-adjusted scores.
        """
        if not scores or not pre_experiment_scores:
            return list(scores) if scores else []
        if len(scores) != len(pre_experiment_scores):
            return list(scores)

        Y = np.array(scores)
        X = np.array(pre_experiment_scores)

        var_x = float(np.var(X))
        if var_x < 1e-10:
            return list(scores)

        cov_xy = float(np.cov(Y, X, ddof=0)[0, 1])
        theta = cov_xy / var_x
        adjusted = Y - theta * (X - np.mean(X))
        return adjusted.tolist()
