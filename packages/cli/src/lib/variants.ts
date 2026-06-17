/** Default A/B variant pair used when no `--variants` are supplied. */
export const DEFAULT_VARIANT_KEYS = ['control', 'variant'];

/**
 * Parse a comma-separated `--variants` option into a clean list of keys.
 *
 * Trims whitespace and drops blank entries (so "a,,b", " a , b ", and trailing
 * commas all sanitize cleanly), mirroring the dashboard's behaviour. Falls back
 * to the default control/variant pair when the input is missing or all-blank,
 * so the CLI never sends an empty list that the API's validation would reject.
 *
 * Note: deliberately does NOT de-duplicate — duplicate keys (e.g. "a,a") are a
 * genuine mistake the API surfaces as a clear validation error rather than one
 * the CLI silently swallows.
 */
export function parseVariantKeys(input?: string): string[] {
  const parsed = input
    ?.split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return parsed && parsed.length > 0 ? parsed : [...DEFAULT_VARIANT_KEYS];
}
