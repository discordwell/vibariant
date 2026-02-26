// Core client
export { Vibariant } from './core/client.js';

// Types
export type {
  VibariantConfig,
  BatchingConfig,
  Experiment,
  VariantAssignment,
  EventType,
  TrackedEvent,
  ClickPayload,
  FormSubmitPayload,
  ScrollPayload,
  NavigationPayload,
  EngagementPayload,
  EventPayload,
  DetectedGoal,
  GoalType,
  GoalTrigger,
  GoalPattern,
  ScannedElement,
  InitRequest,
  InitResponse,
  ExperimentAssignment,
  EventItem,
  EventBatchRequest,
  EventBatchRequestWithToken,
} from './types/index.js';

// Core utilities (for advanced usage)
export { fnv1a, assignVariantLocally } from './core/assignment.js';
export { resolveVisitorId, resolveSessionId } from './core/identity.js';
export { applyDefaults, DEFAULT_CONFIG } from './core/config.js';
export { EventBatcher } from './core/batch.js';
export { GoalDetector } from './goals/index.js';
