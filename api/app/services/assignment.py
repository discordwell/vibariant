"""Deterministic variant assignment using FNV-1a hash.

This MUST match the TypeScript SDK implementation exactly to ensure
consistent assignments whether computed client-side or server-side.
"""

# FNV-1a constants (32-bit)
FNV_OFFSET_BASIS = 0x811C9DC5
FNV_PRIME = 0x01000193
MASK_32 = 0xFFFFFFFF


def fnv1a(data: str) -> int:
    """Compute 32-bit FNV-1a hash of a string."""
    h = FNV_OFFSET_BASIS
    for byte in data.encode("utf-8"):
        h ^= byte
        h = (h * FNV_PRIME) & MASK_32
    return h


def assign_variant(
    visitor_id: str,
    experiment_key: str,
    variant_keys: list[str],
    traffic_percentage: float = 1.0,
) -> str | None:
    """Assign a visitor to a variant deterministically.

    Uses FNV-1a hash: fnv1a(f"{visitor_id}:{experiment_key}") % 1000
    to produce a bucket 0-999. If bucket >= traffic_percentage * 1000,
    the visitor is excluded (returns None).

    Otherwise, the bucket is mapped evenly across variant_keys.

    This logic MUST match the TypeScript SDK implementation.
    """
    bucket = fnv1a(f"{visitor_id}:{experiment_key}") % 1000

    # Traffic gating: exclude visitors outside the traffic percentage
    if bucket >= int(traffic_percentage * 1000):
        return None

    # Map bucket to variant index
    variant_index = bucket % len(variant_keys)
    return variant_keys[variant_index]
