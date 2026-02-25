import type { EventType, NavigationPayload } from '../types/index.js';

type TrackFn = (type: EventType, payload: NavigationPayload) => void;

/**
 * Initialize SPA navigation tracking.
 *
 * Patches History.pushState and History.replaceState to detect
 * client-side navigations. Also listens for popstate events
 * (back/forward buttons).
 */
export function initNavigationTracking(track: TrackFn): () => void {
  let currentUrl = window.location.href;

  // Track the initial page load
  track('navigation', {
    from: document.referrer || '',
    to: currentUrl,
    type: 'initial',
  });

  const trackNavigation = (to: string, type: NavigationPayload['type']) => {
    if (to === currentUrl) return; // No actual navigation
    const from = currentUrl;
    currentUrl = to;

    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => track('navigation', { from, to, type }));
    } else {
      setTimeout(() => track('navigation', { from, to, type }), 0);
    }
  };

  // Patch pushState
  const originalPushState = history.pushState.bind(history);
  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    originalPushState(...args);
    trackNavigation(window.location.href, 'pushState');
  };

  // Patch replaceState
  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    originalReplaceState(...args);
    trackNavigation(window.location.href, 'replaceState');
  };

  // Listen for popstate (back/forward)
  const popstateHandler = () => {
    trackNavigation(window.location.href, 'popstate');
  };
  window.addEventListener('popstate', popstateHandler);

  return () => {
    // Restore original methods
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.removeEventListener('popstate', popstateHandler);
  };
}
