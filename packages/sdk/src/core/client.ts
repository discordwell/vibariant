import type {
  VibeVariantConfig,
  Experiment,
  VariantAssignment,
  TrackedEvent,
  EventType,
  EventPayload,
  InitRequest,
  InitResponse,
  DetectedGoal,
} from '../types/index.js';
import { applyDefaults, type ResolvedConfig } from './config.js';
import { resolveVisitorId, resolveSessionId } from './identity.js';
import { assignVariantLocally } from './assignment.js';
import { EventBatcher } from './batch.js';
import { initAllTrackers, teardownAllTrackers } from '../tracking/index.js';
import { GoalDetector } from '../goals/index.js';

export class VibeVariant {
  private config: ResolvedConfig;
  private visitorId = '';
  private sessionId = '';
  private experiments: Map<string, Experiment> = new Map();
  private assignments: Map<string, VariantAssignment> = new Map();
  private batcher: EventBatcher | null = null;
  private goalDetector: GoalDetector | null = null;
  private initialized = false;
  private trackingTeardown: (() => void) | null = null;

  constructor(config: VibeVariantConfig) {
    this.config = applyDefaults(config);
  }

  /**
   * Initialize the SDK:
   *   1. Resolve visitor and session IDs
   *   2. Start event batching
   *   3. Fetch server config / assignments
   *   4. Retry any pending events from previous sessions
   *   5. Start auto-tracking (if enabled)
   *   6. Start goal detection (if enabled)
   */
  async init(): Promise<void> {
    if (this.initialized) {
      this.log('Already initialized');
      return;
    }

    this.visitorId = resolveVisitorId(this.config.visitorId);
    this.sessionId = resolveSessionId();

    this.log(`Initialized: visitor=${this.visitorId}, session=${this.sessionId}`);

    // Start batching
    this.batcher = new EventBatcher(this.config);
    this.batcher.start();

    // Fetch server config
    await this.fetchInit();

    // Retry pending events from previous failed flushes
    await this.batcher.retryPending();

    // Start auto-tracking
    if (this.config.autoTrack) {
      this.trackingTeardown = initAllTrackers((type, payload) => {
        this.track(type, payload);
      });
    }

    // Start goal detection
    if (this.config.autoGoals) {
      this.goalDetector = new GoalDetector((goal) => {
        this.track('goal', {
          goalId: goal.id,
          goalType: goal.goalType,
          label: goal.label,
          confidence: goal.confidence,
          trigger: goal.trigger,
        });
      });
      this.goalDetector.start();
    }

    this.initialized = true;
  }

  /**
   * Register an experiment that the client code uses.
   * If the server already provided an assignment for this experiment,
   * use the server assignment. Otherwise, assign locally.
   */
  registerExperiment(experiment: Experiment): VariantAssignment {
    this.experiments.set(experiment.key, experiment);

    // Check if we already have an assignment
    const existing = this.assignments.get(experiment.key);
    if (existing) return existing;

    // Assign locally
    const assignment = assignVariantLocally(
      this.visitorId,
      experiment.key,
      experiment.variants,
      experiment.weights,
    );
    this.assignments.set(experiment.key, assignment);

    this.log(`Assigned: ${experiment.key} -> ${assignment.variantKey} (bucket ${assignment.bucket})`);

    return assignment;
  }

  /**
   * Get the current assignment for an experiment.
   * If the experiment hasn't been registered yet, register it with the provided variants.
   */
  getAssignment(experimentKey: string, variants?: string[]): VariantAssignment | null {
    const existing = this.assignments.get(experimentKey);
    if (existing) return existing;

    if (variants) {
      return this.registerExperiment({ key: experimentKey, variants });
    }

    return null;
  }

  /**
   * Track an event. This queues the event for batch sending.
   */
  track(type: EventType, payload: EventPayload = {}): void {
    if (!this.batcher) {
      this.log('Cannot track: SDK not initialized');
      return;
    }

    const event: TrackedEvent = {
      id: this.generateEventId(),
      type,
      timestamp: new Date().toISOString(),
      visitorId: this.visitorId,
      sessionId: this.sessionId,
      url: typeof window !== 'undefined' ? window.location.href : '',
      assignments: this.getAssignmentMap(),
      payload,
    };

    this.batcher.enqueue(event);
  }

  /**
   * Get detected goals (if goal detection is enabled).
   */
  getDetectedGoals(): DetectedGoal[] {
    return this.goalDetector?.getGoals() ?? [];
  }

  /**
   * Get the current visitor ID.
   */
  getVisitorId(): string {
    return this.visitorId;
  }

  /**
   * Get the current session ID.
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get all current assignments as a simple key -> variant map.
   */
  getAssignmentMap(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const [key, assignment] of this.assignments) {
      map[key] = assignment.variantKey;
    }
    return map;
  }

  /**
   * Tear down the SDK: stop batching, flush remaining events, clean up listeners.
   */
  async destroy(): Promise<void> {
    if (this.trackingTeardown) {
      this.trackingTeardown();
      this.trackingTeardown = null;
    }

    teardownAllTrackers();

    if (this.goalDetector) {
      this.goalDetector.teardown();
      this.goalDetector = null;
    }

    if (this.batcher) {
      this.batcher.stop();
      await this.batcher.flush();
      this.batcher = null;
    }

    this.initialized = false;
    this.log('Destroyed');
  }

  /**
   * Fetch experiment configuration and assignments from the server.
   */
  private async fetchInit(): Promise<void> {
    const requestBody: InitRequest = {
      visitor_id: this.visitorId,
      session_id: this.sessionId,
      attributes: Object.keys(this.config.attributes).length > 0 ? this.config.attributes : undefined,
    };

    try {
      const response = await fetch(`${this.config.apiHost}/api/v1/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Project-Token': this.config.projectToken,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        this.log(`Init request failed: ${response.status}`);
        return;
      }

      const data = (await response.json()) as InitResponse;

      // Apply server assignments (override local)
      // API returns assignments as a list of { experiment_key, variant }
      for (const assignment of data.assignments) {
        this.assignments.set(assignment.experiment_key, {
          experimentKey: assignment.experiment_key,
          variantKey: assignment.variant,
          visitorId: this.visitorId,
          bucket: -1, // Server-assigned, bucket not relevant
          source: 'server',
        });
      }

      this.log(`Server init: ${data.assignments.length} assignments`);
    } catch {
      this.log('Init request failed: network error (using local assignments)');
    }
  }

  /**
   * Generate a unique event ID.
   */
  private generateEventId(): string {
    try {
      const bytes = new Uint8Array(8);
      crypto.getRandomValues(bytes);
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${Date.now().toString(36)}-${hex}`;
    } catch {
      return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  /**
   * Debug logger.
   */
  private log(message: string): void {
    if (this.config.debug) {
      console.debug(`[VibeVariant] ${message}`);
    }
  }
}
