"""Unit tests for deterministic variant assignment.

These run with no database or live server, unlike ``test_e2e_flow.py``.

The most important invariant here is **cross-language parity**: the Python
``fnv1a`` / ``assign_variant`` must produce byte-for-byte identical results to
the TypeScript SDK (``packages/sdk/src/core/assignment.ts``). The hash and
bucket constants below are the exact values asserted in the SDK's own test
suite (``packages/sdk/src/__tests__/assignment.test.ts``). If either side
drifts, a visitor could be assigned different variants client- vs server-side,
silently corrupting an experiment — so these assertions guard both languages.
"""

import sys

sys.path.insert(0, "/Users/discordwell/Projects/vibariant/api")

from app.services.assignment import assign_variant, fnv1a


# ======================================================================
# FNV-1a hash — must match the SDK byte-for-byte
# ======================================================================


class TestFnv1aParity:
    """Hash values mirror packages/sdk/src/__tests__/assignment.test.ts."""

    def test_empty_string(self):
        # FNV offset basis: 0x811c9dc5
        assert fnv1a("") == 2166136261

    def test_hello(self):
        assert fnv1a("hello") == 1335831723

    def test_abc(self):
        assert fnv1a("abc") == 440920331

    def test_test(self):
        assert fnv1a("test") == 2949673445

    def test_compound_key(self):
        assert fnv1a("visitor123:hero-headline") == 2187615758

    def test_second_compound_key(self):
        assert fnv1a("test_visitor:hero-cta") == 2186455057

    def test_unicode_consistency(self):
        # Multi-byte UTF-8 must hash consistently across languages.
        assert fnv1a("café:experiment") == 4080878006

    def test_always_unsigned_32bit(self):
        h = fnv1a("any string")
        assert 0 <= h <= 0xFFFFFFFF


# ======================================================================
# assign_variant — equal-weight modulo mapping (matches SDK)
# ======================================================================


class TestAssignVariantParity:
    """Bucket/variant mappings mirror the SDK assignment tests."""

    def test_bucket_is_758_for_known_key(self):
        # The variant returned depends only on bucket % len(variant_keys);
        # we assert each cardinality the SDK test covers.
        assert fnv1a("visitor123:hero-headline") % 1000 == 758

    def test_two_variants(self):
        # 758 % 2 == 0 -> first variant
        assert assign_variant("visitor123", "hero-headline", ["control", "variant_a"]) == "control"

    def test_three_variants(self):
        # 758 % 3 == 2 -> third variant
        assert assign_variant("visitor123", "hero-headline", ["a", "b", "c"]) == "c"

    def test_three_variants_alternate_key(self):
        # fnv1a("test_visitor:hero-cta") % 1000 == 57; 57 % 3 == 0 -> first.
        assert assign_variant("test_visitor", "hero-cta", ["control", "bold", "minimal"]) == "control"

    def test_five_variants(self):
        # 758 % 5 == 3 -> fourth variant
        assert assign_variant("visitor123", "hero-headline", ["a", "b", "c", "d", "e"]) == "d"


class TestAssignVariantBehaviour:
    def test_deterministic(self):
        results = {assign_variant("visitor_123", "exp_abc", ["a", "b", "c"]) for _ in range(100)}
        assert len(results) == 1

    def test_different_visitors_can_differ(self):
        # Not guaranteed per-pair, but across many visitors we see both variants.
        seen = {
            assign_variant(f"visitor-{i}", "test-exp", ["control", "variant_a"])
            for i in range(50)
        }
        assert seen == {"control", "variant_a"}

    def test_distribution_roughly_even(self):
        counts = {"control": 0, "variant_a": 0}
        for i in range(1000):
            counts[assign_variant(f"visitor-{i}", "test-exp", ["control", "variant_a"])] += 1
        # Generous tolerance — modulo over a uniform hash gives ~50/50.
        assert 350 < counts["control"] < 650
        assert 350 < counts["variant_a"] < 650


class TestTrafficGating:
    def test_zero_traffic_excludes_everyone(self):
        assert assign_variant("any_visitor", "any_exp", ["a", "b"], traffic_percentage=0.0) is None

    def test_full_traffic_includes_everyone(self):
        assert all(
            assign_variant(f"v{i}", "exp", ["a", "b"], traffic_percentage=1.0) is not None
            for i in range(100)
        )

    def test_partial_traffic_excludes_high_buckets(self):
        # bucket for this key is 758, which is >= 0.5 * 1000 -> excluded.
        assert assign_variant("visitor123", "hero-headline", ["a", "b"], traffic_percentage=0.5) is None


class TestEmptyVariantsGuard:
    """Regression: an experiment with no variants must not crash /init."""

    def test_empty_variant_keys_returns_none(self):
        # Previously raised ZeroDivisionError (bucket % 0), 500-ing the public
        # SDK init endpoint for the whole project.
        assert assign_variant("visitor", "exp", []) is None

    def test_empty_variant_keys_with_traffic_returns_none(self):
        assert assign_variant("visitor", "exp", [], traffic_percentage=1.0) is None
