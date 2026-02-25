import type { DetectedGoal } from '../types/index.js';
import { scanDOM, scanPage } from './scanner.js';
import { classifyElement, classifyPage } from './classifier.js';
import { rankGoals, filterByConfidence } from './ranker.js';

type GoalCallback = (goal: DetectedGoal) => void;

/**
 * GoalDetector: orchestrates DOM scanning, classification, ranking,
 * and reporting of auto-detected conversion goals.
 *
 * Uses MutationObserver to detect dynamically added elements
 * and re-scans when the DOM changes.
 */
export class GoalDetector {
  private goals: Map<string, DetectedGoal> = new Map();
  private observer: MutationObserver | null = null;
  private onGoalDetected: GoalCallback;
  private scanScheduled = false;
  private started = false;

  constructor(onGoalDetected: GoalCallback) {
    this.onGoalDetected = onGoalDetected;
  }

  /**
   * Start goal detection:
   *   1. Perform an initial scan of the current DOM
   *   2. Set up a MutationObserver for dynamic content
   */
  start(): void {
    if (this.started) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    this.started = true;

    // Initial scan after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.scan(), { once: true });
    } else {
      // Schedule scan in idle time
      this.scheduleScan();
    }

    // Watch for DOM mutations (SPAs adding new content)
    this.observer = new MutationObserver((mutations) => {
      // Only rescan if meaningful nodes were added
      const hasNewNodes = mutations.some(
        (m) => m.addedNodes.length > 0 && Array.from(m.addedNodes).some(
          (node) => node.nodeType === Node.ELEMENT_NODE,
        ),
      );

      if (hasNewNodes) {
        this.scheduleScan();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Get all detected goals, ranked by score.
   */
  getGoals(): DetectedGoal[] {
    return rankGoals(Array.from(this.goals.values()));
  }

  /**
   * Stop goal detection and clean up.
   */
  teardown(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.started = false;
  }

  /**
   * Schedule a scan using requestIdleCallback to avoid blocking the main thread.
   * Debounces multiple rapid DOM changes into a single scan.
   */
  private scheduleScan(): void {
    if (this.scanScheduled) return;
    this.scanScheduled = true;

    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => {
        this.scan();
        this.scanScheduled = false;
      });
    } else {
      setTimeout(() => {
        this.scan();
        this.scanScheduled = false;
      }, 100);
    }
  }

  /**
   * Perform a full scan:
   *   1. Scan DOM for interactive elements
   *   2. Classify each element against goal patterns
   *   3. Scan page-level signals (URL, title)
   *   4. Classify page signals
   *   5. Rank and deduplicate
   *   6. Report new goals via callback
   */
  private scan(): void {
    const allCandidates: DetectedGoal[] = [];

    // Scan and classify interactive elements
    const elements = scanDOM();
    for (const el of elements) {
      const goals = classifyElement(el);
      allCandidates.push(...goals);
    }

    // Scan and classify page-level signals
    const pageInfo = scanPage();
    const pageGoals = classifyPage(pageInfo);
    allCandidates.push(...pageGoals);

    // Filter by minimum confidence
    const filtered = filterByConfidence(allCandidates, 0.3);

    // Rank and deduplicate
    const ranked = rankGoals(filtered);

    // Report new goals
    for (const goal of ranked) {
      if (!this.goals.has(goal.id)) {
        this.goals.set(goal.id, goal);
        this.onGoalDetected(goal);
      }
    }
  }
}
