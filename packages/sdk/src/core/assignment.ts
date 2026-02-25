import type { VariantAssignment } from '../types/index.js';

/**
 * FNV-1a 32-bit hash.
 *
 * CRITICAL: This MUST produce identical results to the Python backend:
 *   hash = 0x811c9dc5 (FNV offset basis)
 *   for each byte:
 *     hash ^= byte
 *     hash *= 0x01000193 (FNV prime)
 *     hash &= 0xFFFFFFFF (keep 32-bit)
 *
 * The `>>> 0` ensures unsigned 32-bit arithmetic in JavaScript.
 */
export function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  const bytes = new TextEncoder().encode(str);
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * Deterministic variant assignment using FNV-1a hashing.
 *
 * Algorithm:
 *   1. Hash `${visitorId}:${experimentKey}` with FNV-1a
 *   2. Bucket = hash % 1000 (gives 0-999)
 *   3. Divide buckets equally among variant keys
 *
 * With 2 variants and bucket 0-999:
 *   - Buckets 0-499  -> variant[0]
 *   - Buckets 500-999 -> variant[1]
 *
 * With 3 variants:
 *   - Buckets 0-333   -> variant[0]
 *   - Buckets 334-666  -> variant[1]
 *   - Buckets 667-999  -> variant[2]
 */
export function assignVariantLocally(
  visitorId: string,
  experimentKey: string,
  variantKeys: string[],
  weights?: number[],
): VariantAssignment {
  if (variantKeys.length === 0) {
    throw new Error(`[VibeVariant] Experiment "${experimentKey}" has no variants`);
  }

  const hash = fnv1a(`${visitorId}:${experimentKey}`);
  const bucket = hash % 1000;

  let assignedVariant: string;

  if (weights && weights.length === variantKeys.length) {
    // Weighted assignment: weights should sum to 1.0
    // Map weights to bucket ranges within 0-999
    let cumulative = 0;
    assignedVariant = variantKeys[variantKeys.length - 1]; // fallback to last
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i] * 1000;
      if (bucket < cumulative) {
        assignedVariant = variantKeys[i];
        break;
      }
    }
  } else {
    // Equal-weight assignment — must match Python: bucket % len(variant_keys)
    const index = bucket % variantKeys.length;
    assignedVariant = variantKeys[index];
  }

  return {
    experimentKey,
    variantKey: assignedVariant,
    visitorId,
    bucket,
    source: 'local',
  };
}
