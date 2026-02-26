import type { EventType, EventPayload, FormSubmitPayload, DetectedGoal } from '../types/index.js';
import { generateSelector } from './clicks.js';

type TrackFn = (type: EventType, payload: EventPayload) => void;
type GoalLookupFn = () => DetectedGoal[];

/**
 * Extract field names from a form.
 * Only collects names — never values — for privacy.
 */
function extractFieldNames(form: HTMLFormElement): string[] {
  const names: string[] = [];
  const elements = form.elements;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i] as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (el.name && !names.includes(el.name)) {
      // Skip hidden fields and submit buttons (they're not meaningful field data)
      if (el instanceof HTMLInputElement && (el.type === 'hidden' || el.type === 'submit')) {
        continue;
      }
      names.push(el.name);
    }
  }

  return names;
}

/**
 * Check if a submitted form matches any detected goal's trigger selector.
 * Returns the matching goal if found, null otherwise.
 */
function findMatchingFormGoal(form: HTMLFormElement, selector: string, getGoals?: GoalLookupFn): DetectedGoal | null {
  if (!getGoals) return null;

  const goals = getGoals();
  for (const goal of goals) {
    if (goal.trigger.type !== 'form_submit') continue;

    // Match by trigger selector
    if (goal.trigger.selector) {
      try {
        if (form.matches(goal.trigger.selector) || selector === goal.trigger.selector) {
          return goal;
        }
      } catch {
        if (selector === goal.trigger.selector) {
          return goal;
        }
      }
    }
  }

  return null;
}

/**
 * Initialize form submission tracking.
 * Listens for submit events on all forms and tracks field names (never values).
 * When a form submission matches a detected goal, includes goalId in the payload
 * and emits a separate goal_completed event.
 */
export function initFormTracking(track: TrackFn, getGoals?: GoalLookupFn): () => void {
  const handler = (e: SubmitEvent) => {
    const form = e.target as HTMLFormElement | null;
    if (!form || form.tagName !== 'FORM') return;

    const selector = generateSelector(form);
    const matchedGoal = findMatchingFormGoal(form, selector, getGoals);

    const payload: FormSubmitPayload & { goalId?: string } = {
      selector,
      action: form.action || window.location.href,
      method: (form.method || 'GET').toUpperCase(),
      fieldNames: extractFieldNames(form),
    };

    // Include goalId in the form_submit payload if a goal was matched
    if (matchedGoal) {
      payload.goalId = matchedGoal.id;
    }

    // Track synchronously since the page might navigate away on form submit
    track('form_submit', payload);

    // Emit a separate goal_completed event when a goal is matched
    if (matchedGoal) {
      track('goal_completed', {
        goalId: matchedGoal.id,
        goalType: matchedGoal.goalType,
        label: matchedGoal.label,
        trigger: matchedGoal.trigger,
        completedVia: 'form_submit',
        selector,
      });
    }
  };

  document.addEventListener('submit', handler, { capture: true });

  return () => {
    document.removeEventListener('submit', handler, { capture: true });
  };
}
