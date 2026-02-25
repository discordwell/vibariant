import type { EventType, EngagementPayload } from '../types/index.js';

type TrackFn = (type: EventType, payload: EngagementPayload) => void;

const IDLE_THRESHOLD_MS = 30_000; // 30 seconds without interaction = idle
const REPORT_INTERVAL_MS = 30_000; // Report engagement every 30 seconds

/**
 * Initialize engagement tracking.
 *
 * Tracks:
 *   - Total time on page
 *   - Active time (not idle — user has interacted within last 30s)
 *   - Interaction count (clicks, scrolls, keypresses)
 *
 * Reports periodically and on page unload.
 */
export function initEngagementTracking(track: TrackFn): () => void {
  const startTime = Date.now();
  let activeTimeMs = 0;
  let lastActiveCheck = Date.now();
  let lastInteraction = Date.now();
  let interactionCount = 0;
  let isActive = true;

  // Track active time by periodically checking if the user is still active
  const activeInterval = setInterval(() => {
    const now = Date.now();
    if (isActive) {
      activeTimeMs += now - lastActiveCheck;
    }
    lastActiveCheck = now;

    // Check if user has gone idle
    if (now - lastInteraction > IDLE_THRESHOLD_MS) {
      isActive = false;
    }
  }, 1000);

  // Track interactions
  const interactionHandler = () => {
    interactionCount++;
    lastInteraction = Date.now();
    if (!isActive) {
      isActive = true;
      lastActiveCheck = Date.now();
    }
  };

  const interactionEvents = ['click', 'scroll', 'keydown', 'mousemove', 'touchstart'] as const;
  for (const event of interactionEvents) {
    window.addEventListener(event, interactionHandler, { passive: true, capture: true });
  }

  const buildPayload = (): EngagementPayload => ({
    totalTimeMs: Date.now() - startTime,
    activeTimeMs: activeTimeMs + (isActive ? Date.now() - lastActiveCheck : 0),
    interactionCount,
  });

  // Periodic engagement report
  const reportInterval = setInterval(() => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => track('engagement', buildPayload()));
    } else {
      setTimeout(() => track('engagement', buildPayload()), 0);
    }
  }, REPORT_INTERVAL_MS);

  // Report on visibility change (tab switch, minimize)
  const visibilityHandler = () => {
    if (document.visibilityState === 'hidden') {
      track('engagement', buildPayload());
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  return () => {
    clearInterval(activeInterval);
    clearInterval(reportInterval);
    document.removeEventListener('visibilitychange', visibilityHandler);
    for (const event of interactionEvents) {
      window.removeEventListener(event, interactionHandler, { capture: true });
    }

    // Send final engagement report
    track('engagement', buildPayload());
  };
}
