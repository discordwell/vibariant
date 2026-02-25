import type { EventType, EventPayload } from '../types/index.js';
import { initClickTracking } from './clicks.js';
import { initFormTracking } from './forms.js';
import { initNavigationTracking } from './navigation.js';
import { initScrollTracking } from './scroll.js';
import { initEngagementTracking } from './engagement.js';

type TrackFn = (type: EventType, payload: EventPayload) => void;

/** Accumulated teardown functions from all active trackers. */
let teardowns: Array<() => void> = [];

/**
 * Initialize all automatic trackers.
 *
 * Each tracker registers its own event listeners and returns
 * a teardown function. All trackers use requestIdleCallback
 * where possible to avoid blocking the main thread.
 *
 * @returns A combined teardown function that removes all listeners.
 */
export function initAllTrackers(track: TrackFn): () => void {
  // Only run in browser environments
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  teardowns = [
    initClickTracking(track),
    initFormTracking(track),
    initNavigationTracking(track),
    initScrollTracking(track),
    initEngagementTracking(track),
  ];

  return () => {
    teardownAllTrackers();
  };
}

/**
 * Teardown all active trackers.
 */
export function teardownAllTrackers(): void {
  for (const fn of teardowns) {
    try {
      fn();
    } catch {
      // Silently handle teardown errors
    }
  }
  teardowns = [];
}
