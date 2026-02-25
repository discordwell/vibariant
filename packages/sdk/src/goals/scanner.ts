import type { ScannedElement } from '../types/index.js';
import { generateSelector } from '../tracking/clicks.js';

/**
 * Selectors for interactive elements worth scanning for goal classification.
 */
const INTERACTIVE_SELECTORS = [
  'button',
  'a[href]',
  'input[type="submit"]',
  'input[type="button"]',
  '[role="button"]',
  'form',
  '[data-vv-goal]',
  '[data-action]',
  '.cta',
  '[class*="cta"]',
  '[class*="btn"]',
  '[class*="button"]',
].join(', ');

/**
 * Check if an element is visible in the viewport.
 */
function isVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Get visible text content of an element (without child block-level elements).
 */
function getVisibleText(el: Element): string {
  // For inputs, use value or placeholder
  if (el instanceof HTMLInputElement) {
    return el.value || el.placeholder || el.getAttribute('aria-label') || '';
  }

  // Use innerText for rendered text (respects CSS visibility)
  return (el as HTMLElement).innerText?.trim() ?? el.textContent?.trim() ?? '';
}

/**
 * Scan the DOM for interactive elements that might be conversion goals.
 *
 * Returns an array of ScannedElement objects with normalized metadata.
 */
export function scanDOM(): ScannedElement[] {
  const elements: ScannedElement[] = [];
  const seen = new Set<Element>();

  try {
    const candidates = document.querySelectorAll(INTERACTIVE_SELECTORS);

    for (const el of candidates) {
      if (seen.has(el)) continue;
      seen.add(el);

      const visible = isVisible(el);
      const rect = el.getBoundingClientRect();
      const text = getVisibleText(el);

      elements.push({
        element: el,
        selector: generateSelector(el),
        text: text.slice(0, 200), // Truncate long text
        tagName: el.tagName,
        type: el instanceof HTMLInputElement ? el.type : undefined,
        href: el instanceof HTMLAnchorElement ? el.href : undefined,
        visible,
        rect: {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
        },
      });
    }
  } catch {
    // DOM query failed — return empty
  }

  return elements;
}

/**
 * Scan for page-level goal signals (URL patterns, meta tags, page content).
 * Returns signals that can be used by the classifier independently of elements.
 */
export function scanPage(): { url: string; title: string; headingText: string } {
  return {
    url: window.location.href,
    title: document.title,
    headingText: Array.from(document.querySelectorAll('h1, h2'))
      .map((h) => (h as HTMLElement).innerText?.trim() ?? '')
      .join(' ')
      .slice(0, 500),
  };
}
