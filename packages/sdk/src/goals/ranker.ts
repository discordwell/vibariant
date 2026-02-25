import type { DetectedGoal } from '../types/index.js';

/**
 * Rank detected goals by a composite score of confidence and importance.
 *
 * Score = confidence * importance
 *
 * Also deduplicates goals with the same ID, keeping the highest-scoring version.
 *
 * @param goals - Unranked, potentially duplicated goals
 * @param maxGoals - Maximum number of goals to return (default: 20)
 * @returns Ranked, deduplicated goals sorted by score descending
 */
export function rankGoals(goals: DetectedGoal[], maxGoals = 20): DetectedGoal[] {
  // Deduplicate by ID, keeping highest confidence
  const byId = new Map<string, DetectedGoal>();

  for (const goal of goals) {
    const existing = byId.get(goal.id);
    if (!existing || score(goal) > score(existing)) {
      byId.set(goal.id, goal);
    }
  }

  // Sort by composite score descending
  const ranked = Array.from(byId.values()).sort((a, b) => score(b) - score(a));

  return ranked.slice(0, maxGoals);
}

/**
 * Calculate the composite score for a goal.
 * confidence (0-1) * importance (0-1) = score (0-1)
 */
function score(goal: DetectedGoal): number {
  return goal.confidence * goal.importance;
}

/**
 * Filter goals that meet a minimum confidence threshold.
 */
export function filterByConfidence(goals: DetectedGoal[], minConfidence = 0.3): DetectedGoal[] {
  return goals.filter((g) => g.confidence >= minConfidence);
}
