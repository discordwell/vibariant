import type { EventType, FormSubmitPayload } from '../types/index.js';
import { generateSelector } from './clicks.js';

type TrackFn = (type: EventType, payload: FormSubmitPayload) => void;

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
 * Initialize form submission tracking.
 * Listens for submit events on all forms and tracks field names (never values).
 */
export function initFormTracking(track: TrackFn): () => void {
  const handler = (e: SubmitEvent) => {
    const form = e.target as HTMLFormElement | null;
    if (!form || form.tagName !== 'FORM') return;

    const payload: FormSubmitPayload = {
      selector: generateSelector(form),
      action: form.action || window.location.href,
      method: (form.method || 'GET').toUpperCase(),
      fieldNames: extractFieldNames(form),
    };

    // Track synchronously since the page might navigate away on form submit
    track('form_submit', payload);
  };

  document.addEventListener('submit', handler, { capture: true });

  return () => {
    document.removeEventListener('submit', handler, { capture: true });
  };
}
