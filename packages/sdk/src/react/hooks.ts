import { useContext, useMemo, useCallback } from 'react';
import type { VariantAssignment, EventType, EventPayload } from '../types/index.js';
import { VibariantContext } from './provider.js';

/**
 * Access the raw Vibariant client and ready state.
 *
 * Usage:
 * ```tsx
 * const { client, ready } = useVibariant();
 * ```
 */
export function useVibariant() {
  const ctx = useContext(VibariantContext);
  if (!ctx.client && typeof window !== 'undefined') {
    console.warn('[Vibariant] useVibariant() called outside <VibariantProvider>');
  }
  return ctx;
}

/**
 * Get the variant assignment for an experiment.
 *
 * Registers the experiment on first call and returns a stable assignment.
 * The assignment is deterministic — same visitor always gets the same variant.
 *
 * Usage:
 * ```tsx
 * const { variant, assignment } = useVariant('hero-headline', ['control', 'bold', 'minimal']);
 *
 * if (variant === 'control') return <h1>Welcome</h1>;
 * if (variant === 'bold') return <h1>TRANSFORM YOUR BUSINESS</h1>;
 * return <h1>Simple. Effective.</h1>;
 * ```
 *
 * @param experimentKey - Unique experiment identifier
 * @param variants - Array of variant keys
 * @returns Object with `variant` (the assigned variant key) and full `assignment` object
 */
export function useVariant(
  experimentKey: string,
  variants: string[],
): { variant: string; assignment: VariantAssignment | null } {
  const { client } = useContext(VibariantContext);

  const assignment = useMemo(() => {
    if (!client) return null;
    return client.getAssignment(experimentKey, variants);
    // Variants array identity doesn't matter, only the experiment key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, experimentKey]);

  return {
    variant: assignment?.variantKey ?? variants[0],
    assignment,
  };
}

/**
 * Get a tracking function to send custom events.
 *
 * Usage:
 * ```tsx
 * const track = useTrack();
 * <button onClick={() => track('custom', { action: 'cta_click', label: 'hero' })}>
 *   Get Started
 * </button>
 * ```
 */
export function useTrack(): (type: EventType, payload?: EventPayload) => void {
  const { client } = useContext(VibariantContext);

  return useCallback(
    (type: EventType, payload: EventPayload = {}) => {
      if (!client) {
        console.warn('[Vibariant] useTrack() called before client is ready');
        return;
      }
      client.track(type, payload);
    },
    [client],
  );
}
