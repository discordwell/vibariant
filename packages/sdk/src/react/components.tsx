import React from 'react';
import { useVariant } from './hooks.js';

export interface ExperimentProps {
  /** Unique experiment key */
  name: string;
  /**
   * Record mapping variant keys to React elements.
   * The first key is used as the fallback if the client isn't ready.
   *
   * Usage:
   * ```tsx
   * <Experiment name="pricing-layout">
   *   {{
   *     control: <PricingGrid />,
   *     compact: <PricingCompact />,
   *     minimal: <PricingMinimal />,
   *   }}
   * </Experiment>
   * ```
   */
  children: Record<string, React.ReactNode>;
}

/**
 * Declarative experiment component.
 *
 * Renders the variant that the current visitor is assigned to.
 * Falls back to the first variant if the SDK isn't initialized.
 */
export function Experiment({ name, children }: ExperimentProps) {
  const variantKeys = Object.keys(children);

  // Always call hooks before any early return (Rules of Hooks).
  // Pass a placeholder when variantKeys is empty so the hook is still invoked.
  const hookKeys = variantKeys.length > 0 ? variantKeys : ['__placeholder__'];
  const { variant } = useVariant(name, hookKeys);

  if (variantKeys.length === 0) {
    if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).__DEV__) {
      console.warn(`[Vibariant] <Experiment name="${name}"> has no variant children`);
    }
    return null;
  }

  // Render the assigned variant, or fall back to the first one
  const content = children[variant] ?? children[variantKeys[0]];

  return <>{content}</>;
}
