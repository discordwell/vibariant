import type { EventType, ScrollPayload } from '../types/index.js';

type TrackFn = (type: EventType, payload: ScrollPayload) => void;

const MILESTONES = [25, 50, 75, 100];

/**
 * Initialize scroll depth tracking.
 *
 * Tracks scroll milestones (25%, 50%, 75%, 100%) and only fires
 * each milestone once per page. Uses requestIdleCallback to avoid
 * blocking scroll performance.
 */
export function initScrollTracking(track: TrackFn): () => void {
  const reached = new Set<number>();
  let maxDepth = 0;
  let ticking = false;

  const getScrollDepth = (): number => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
    );
    const winHeight = window.innerHeight;

    // Avoid division by zero on short pages
    const scrollable = docHeight - winHeight;
    if (scrollable <= 0) return 100;

    return Math.min(100, Math.round((scrollTop / scrollable) * 100));
  };

  const checkMilestones = () => {
    const depth = getScrollDepth();
    if (depth > maxDepth) {
      maxDepth = depth;
    }

    for (const milestone of MILESTONES) {
      if (depth >= milestone && !reached.has(milestone)) {
        reached.add(milestone);

        const payload: ScrollPayload = {
          depth,
          milestone,
          maxDepth,
        };

        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(() => track('scroll', payload));
        } else {
          setTimeout(() => track('scroll', payload), 0);
        }
      }
    }

    ticking = false;
  };

  const handler = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(checkMilestones);
    }
  };

  window.addEventListener('scroll', handler, { passive: true });

  // Check initial scroll position (page might be loaded scrolled down)
  checkMilestones();

  return () => {
    window.removeEventListener('scroll', handler);
  };
}
