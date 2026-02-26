import type { EventType, EventPayload, DetectedGoal } from '../types/index.js';
import { initClickTracking } from './clicks.js';
import { initFormTracking } from './forms.js';
import { initNavigationTracking } from './navigation.js';
import { initScrollTracking } from './scroll.js';
import { initEngagementTracking } from './engagement.js';

export type TrackFn = (type: EventType, payload: EventPayload) => void;
export type GoalLookupFn = () => DetectedGoal[];

/** Accumulated teardown functions from all active trackers. */
let teardowns: Array<() => void> = [];

/**
 * Initialize all automatic trackers.
 *
 * Each tracker registers its own event listeners and returns
 * a teardown function. All trackers use requestIdleCallback
 * where possible to avoid blocking the main thread.
 *
 * @param track - Function to emit a tracked event.
 * @param getGoals - Optional function to retrieve current detected goals for goal-to-event linking.
 * @returns A combined teardown function that removes all listeners.
 */
export function initAllTrackers(track: TrackFn, getGoals?: GoalLookupFn): () => void {
  // Only run in browser environments
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  teardowns = [
    initClickTracking(track, getGoals),
    initFormTracking(track, getGoals),
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
