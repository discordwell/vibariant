import type { GoalType, ScannedElement, DetectedGoal, GoalTrigger } from '../types/index.js';
import { GOAL_PATTERNS } from './patterns.js';

/**
 * Classify a scanned element by testing it against all goal pattern dictionaries.
 *
 * Returns an array of DetectedGoal candidates (an element may match multiple goal types).
 * Each candidate includes a confidence score based on how many pattern types matched.
 */
export function classifyElement(el: ScannedElement): DetectedGoal[] {
  const goals: DetectedGoal[] = [];

  for (const [goalType, pattern] of Object.entries(GOAL_PATTERNS) as Array<[GoalType, typeof GOAL_PATTERNS[GoalType]]>) {
    let confidence = 0;
    let matchCount = 0;

    // Check text patterns
    const textMatch = pattern.textPatterns.some((regex) => regex.test(el.text));
    if (textMatch) {
      matchCount++;
      confidence += 0.4;
    }

    // Check selector patterns
    const selectorMatch = pattern.selectors.some((sel) => {
      try {
        return el.element.matches(sel);
      } catch {
        return false;
      }
    });
    if (selectorMatch) {
      matchCount++;
      confidence += 0.3;
    }

    // Check URL patterns (for links)
    if (el.href) {
      const urlMatch = pattern.urlPatterns.some((regex) => regex.test(el.href!));
      if (urlMatch) {
        matchCount++;
        confidence += 0.3;
      }
    }

    // Only consider elements with at least one match
    if (matchCount === 0) continue;

    // Boost confidence for visible, prominent elements
    if (el.visible) confidence += 0.05;
    if (el.rect.width > 100 && el.rect.height > 30) confidence += 0.05;

    // Cap at 1.0
    confidence = Math.min(1.0, confidence);

    // Minimum threshold
    if (confidence < 0.2) continue;

    const trigger: GoalTrigger = {
      type: el.tagName === 'FORM' ? 'form_submit' : 'click',
      selector: el.selector,
      text: el.text.slice(0, 100),
    };

    goals.push({
      id: generateGoalId(goalType, el.selector),
      goalType,
      label: generateLabel(goalType, el.text),
      confidence,
      importance: pattern.importance,
      trigger,
    });
  }

  return goals;
}

/**
 * Classify page-level signals (URL, title, headings) for confirmation pages
 * and other page-level goals.
 */
export function classifyPage(pageInfo: { url: string; title: string; headingText: string }): DetectedGoal[] {
  const goals: DetectedGoal[] = [];
  const combinedText = `${pageInfo.title} ${pageInfo.headingText}`;

  for (const [goalType, pattern] of Object.entries(GOAL_PATTERNS) as Array<[GoalType, typeof GOAL_PATTERNS[GoalType]]>) {
    let confidence = 0;

    // Check URL patterns
    const urlMatch = pattern.urlPatterns.some((regex) => regex.test(pageInfo.url));
    if (urlMatch) confidence += 0.4;

    // Check text patterns against page title and headings
    const textMatch = pattern.textPatterns.some((regex) => regex.test(combinedText));
    if (textMatch) confidence += 0.4;

    if (confidence < 0.3) continue;

    const trigger: GoalTrigger = {
      type: 'navigation',
      url: pageInfo.url,
      text: pageInfo.title.slice(0, 100),
    };

    goals.push({
      id: generateGoalId(goalType, pageInfo.url),
      goalType,
      label: generateLabel(goalType, pageInfo.title),
      confidence: Math.min(1.0, confidence),
      importance: pattern.importance,
      trigger,
    });
  }

  return goals;
}

/**
 * Generate a deterministic goal ID from type + selector/URL.
 */
function generateGoalId(goalType: GoalType, identifier: string): string {
  // Simple hash for deduplication
  let hash = 0;
  const str = `${goalType}:${identifier}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `goal_${goalType}_${Math.abs(hash).toString(36)}`;
}

/**
 * Generate a human-readable label for dashboard display.
 */
function generateLabel(goalType: GoalType, text: string): string {
  const truncated = text.slice(0, 50).trim();
  const typeLabels: Record<GoalType, string> = {
    purchase: 'Purchase',
    signup: 'Sign Up',
    lead_capture: 'Lead Capture',
    engagement: 'Engagement',
    confirmation_page: 'Confirmation Page',
  };

  if (truncated) {
    return `${typeLabels[goalType]}: "${truncated}"`;
  }
  return typeLabels[goalType];
}
