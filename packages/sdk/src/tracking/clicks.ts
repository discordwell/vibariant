import type { EventType, EventPayload, ClickPayload, DetectedGoal } from '../types/index.js';

type TrackFn = (type: EventType, payload: EventPayload) => void;
type GoalLookupFn = () => DetectedGoal[];

/**
 * Generate a CSS selector for an element, preferring:
 *   1. ID
 *   2. data-testid / data-vv attributes
 *   3. tag + classes
 *   4. nth-child path (limited depth)
 */
export function generateSelector(el: Element): string {
  // ID selector
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
  }

  // data-testid or data-vv attribute
  const testId = el.getAttribute('data-testid') ?? el.getAttribute('data-vv');
  if (testId) {
    return `[data-testid="${CSS.escape(testId)}"]`;
  }

  // Tag + classes (limit to 3 classes to keep selectors readable)
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList)
    .slice(0, 3)
    .map((c) => `.${CSS.escape(c)}`)
    .join('');

  if (classes) {
    const selector = `${tag}${classes}`;
    // Check if this selector is unique enough
    try {
      const matches = document.querySelectorAll(selector);
      if (matches.length === 1) return selector;
    } catch {
      // Invalid selector — fall through
    }
  }

  // Build a path from the element up (max 3 levels)
  const parts: string[] = [];
  let current: Element | null = el;
  let depth = 0;

  while (current && depth < 3) {
    const currentTag = current.tagName.toLowerCase();
    if (current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`);
      break;
    }

    const parent: Element | null = current.parentElement;
    if (parent) {
      const currentEl = current;
      const siblings = Array.from(parent.children).filter(
        (s: Element) => s.tagName === currentEl.tagName,
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(currentEl) + 1;
        parts.unshift(`${currentTag}:nth-of-type(${index})`);
      } else {
        parts.unshift(currentTag);
      }
    } else {
      parts.unshift(currentTag);
    }

    current = parent;
    depth++;
  }

  return parts.join(' > ');
}

/**
 * Truncate text to a max length, trimming whitespace.
 */
function truncateText(text: string, maxLen = 100): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen) + '...';
}

/**
 * Check if a clicked element matches any detected goal's trigger selector.
 * Returns the matching goal if found, null otherwise.
 */
function findMatchingGoal(element: Element, selector: string, getGoals?: GoalLookupFn): DetectedGoal | null {
  if (!getGoals) return null;

  const goals = getGoals();
  for (const goal of goals) {
    if (goal.trigger.type !== 'click') continue;

    // Match by trigger selector
    if (goal.trigger.selector) {
      try {
        if (element.matches(goal.trigger.selector) || selector === goal.trigger.selector) {
          return goal;
        }
      } catch {
        // Invalid selector — try string comparison fallback
        if (selector === goal.trigger.selector) {
          return goal;
        }
      }
    }
  }

  return null;
}

/**
 * Initialize click tracking.
 * Listens for all clicks on the document and extracts element context.
 * When a click matches a detected goal, includes goalId in the payload
 * and emits a separate goal_completed event.
 */
export function initClickTracking(track: TrackFn, getGoals?: GoalLookupFn): () => void {
  const handler = (e: MouseEvent) => {
    const target = e.target as Element | null;
    if (!target) return;

    // Walk up to find the nearest interactive element
    const interactive = target.closest('a, button, [role="button"], input[type="submit"], [data-vv-track]') ?? target;

    const selector = generateSelector(interactive);
    const matchedGoal = findMatchingGoal(interactive, selector, getGoals);

    const payload: ClickPayload & { goalId?: string } = {
      selector,
      text: truncateText(interactive.textContent ?? ''),
      tagName: interactive.tagName,
      href: interactive instanceof HTMLAnchorElement ? interactive.href : undefined,
      x: e.clientX,
      y: e.clientY,
    };

    // Include goalId in the click payload if a goal was matched
    if (matchedGoal) {
      payload.goalId = matchedGoal.id;
    }

    // Use requestIdleCallback to avoid blocking the main thread
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => {
        track('click', payload);
        // Emit a separate goal_completed event when a goal is matched
        if (matchedGoal) {
          track('goal_completed', {
            goalId: matchedGoal.id,
            goalType: matchedGoal.goalType,
            label: matchedGoal.label,
            trigger: matchedGoal.trigger,
            completedVia: 'click',
            selector,
          });
        }
      });
    } else {
      setTimeout(() => {
        track('click', payload);
        if (matchedGoal) {
          track('goal_completed', {
            goalId: matchedGoal.id,
            goalType: matchedGoal.goalType,
            label: matchedGoal.label,
            trigger: matchedGoal.trigger,
            completedVia: 'click',
            selector,
          });
        }
      }, 0);
    }
  };

  document.addEventListener('click', handler, { capture: true, passive: true });

  return () => {
    document.removeEventListener('click', handler, { capture: true });
  };
}
