// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface BatchingConfig {
  /** Maximum events to buffer before flushing. Default: 10 */
  maxSize: number;
  /** Milliseconds between automatic flushes. Default: 5000 */
  intervalMs: number;
  /** Use navigator.sendBeacon for page-unload flushes. Default: true */
  useSendBeacon: boolean;
}

export interface VibeVariantConfig {
  /** Public project token (vv_proj_xxx). Required. */
  projectToken: string;
  /** API host for event ingestion and experiment fetching. Default: "https://api.vibevariant.com" */
  apiHost?: string;
  /** Automatically track clicks, scrolls, forms, and navigation. Default: true */
  autoTrack?: boolean;
  /** Automatically detect and track conversion goals via DOM heuristics. Default: true */
  autoGoals?: boolean;
  /** Override the visitor ID instead of auto-generating. */
  visitorId?: string;
  /** Arbitrary visitor attributes for targeting / segmentation. */
  attributes?: Record<string, string | number | boolean>;
  /** Batching configuration overrides. */
  batching?: Partial<BatchingConfig>;
  /** Enable console debug logging. Default: false */
  debug?: boolean;
}

// ---------------------------------------------------------------------------
// Experiments & Assignments
// ---------------------------------------------------------------------------

export interface Experiment {
  /** Unique key, e.g. "hero-headline" */
  key: string;
  /** Human-readable name */
  name?: string;
  /** Available variant keys */
  variants: string[];
  /** Traffic allocation per variant (0-1). If omitted, equal split. */
  weights?: number[];
  /** Whether the experiment is active. Default: true */
  active?: boolean;
}

export interface VariantAssignment {
  experimentKey: string;
  variantKey: string;
  visitorId: string;
  /** Hash bucket 0-999 used for assignment */
  bucket: number;
  /** Whether assignment came from server or local fallback */
  source: 'server' | 'local';
}

// ---------------------------------------------------------------------------
// Event Tracking
// ---------------------------------------------------------------------------

export type EventType =
  | 'click'
  | 'form_submit'
  | 'scroll'
  | 'navigation'
  | 'engagement'
  | 'goal'
  | 'goal_completed'
  | 'custom';

export interface ClickPayload {
  /** CSS selector of the clicked element */
  selector: string;
  /** innerText of the element, truncated */
  text: string;
  /** Tag name (A, BUTTON, etc.) */
  tagName: string;
  /** href if the element is a link */
  href?: string;
  /** Coordinates relative to viewport */
  x: number;
  y: number;
}

export interface FormSubmitPayload {
  /** CSS selector of the form */
  selector: string;
  /** Form action URL */
  action: string;
  /** Form method */
  method: string;
  /** Field names only — never values, for privacy */
  fieldNames: string[];
}

export interface ScrollPayload {
  /** Scroll depth as a percentage 0-100 */
  depth: number;
  /** Which milestone was reached (25, 50, 75, 100) */
  milestone: number;
  /** Max depth reached in this page view */
  maxDepth: number;
}

export interface NavigationPayload {
  /** URL navigated from */
  from: string;
  /** URL navigated to */
  to: string;
  /** Navigation type */
  type: 'pushState' | 'replaceState' | 'popstate' | 'initial';
}

export interface EngagementPayload {
  /** Total time on the page in milliseconds */
  totalTimeMs: number;
  /** Active time (not idle) in milliseconds */
  activeTimeMs: number;
  /** Number of interactions (clicks, scrolls, keypresses) */
  interactionCount: number;
}

export type EventPayload =
  | ClickPayload
  | FormSubmitPayload
  | ScrollPayload
  | NavigationPayload
  | EngagementPayload
  | Record<string, unknown>;

export interface TrackedEvent {
  /** Unique event ID */
  id: string;
  /** Event type */
  type: EventType;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Visitor ID */
  visitorId: string;
  /** Session ID */
  sessionId: string;
  /** Current page URL */
  url: string;
  /** Active experiment assignments at event time */
  assignments: Record<string, string>;
  /** Event-specific payload */
  payload: EventPayload;
}

// ---------------------------------------------------------------------------
// Goal Detection
// ---------------------------------------------------------------------------

export type GoalType =
  | 'purchase'
  | 'signup'
  | 'lead_capture'
  | 'engagement'
  | 'confirmation_page';

export interface GoalTrigger {
  /** What triggered the goal detection */
  type: 'click' | 'form_submit' | 'navigation' | 'dom_content';
  /** CSS selector of the trigger element, if applicable */
  selector?: string;
  /** Text content of the trigger */
  text?: string;
  /** URL that matched a goal pattern */
  url?: string;
}

export interface DetectedGoal {
  /** Auto-generated goal ID */
  id: string;
  /** Classified goal type */
  goalType: GoalType;
  /** Human-readable label for dashboard confirmation */
  label: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Importance weight 0-1 for ranking */
  importance: number;
  /** What triggered this goal */
  trigger: GoalTrigger;
  /** Whether this goal has been confirmed by the user in the dashboard */
  confirmed?: boolean;
}

// ---------------------------------------------------------------------------
// Goal Pattern Matching
// ---------------------------------------------------------------------------

export interface GoalPattern {
  /** Regex patterns to match against element text content */
  textPatterns: RegExp[];
  /** CSS selectors that suggest this goal type */
  selectors: string[];
  /** URL path patterns that suggest this goal type */
  urlPatterns: RegExp[];
  /** Base importance score for this goal type */
  importance: number;
}

// ---------------------------------------------------------------------------
// Scanned Element (internal)
// ---------------------------------------------------------------------------

export interface ScannedElement {
  /** The DOM element */
  element: Element;
  /** Generated CSS selector */
  selector: string;
  /** Visible text content */
  text: string;
  /** Tag name */
  tagName: string;
  /** Element type attribute (for inputs) */
  type?: string;
  /** href for links */
  href?: string;
  /** Whether the element is visible */
  visible: boolean;
  /** Bounding rect for position/size context */
  rect: { width: number; height: number; top: number; left: number };
}

// ---------------------------------------------------------------------------
// API Request / Response Types
// ---------------------------------------------------------------------------

export interface InitRequest {
  visitor_id: string;
  session_id?: string;
  attributes?: Record<string, string | number | boolean>;
}

export interface ExperimentAssignment {
  experiment_key: string;
  variant: string;
}

export interface InitResponse {
  visitor_id: string;
  assignments: ExperimentAssignment[];
}

/**
 * A single event as the API expects it (snake_case fields).
 */
export interface EventItem {
  visitor_id: string;
  session_id: string;
  experiment_assignments: Record<string, string> | null;
  event_type: string;
  payload: Record<string, unknown> | null;
  timestamp: string;
}

export interface EventBatchRequest {
  events: EventItem[];
}

/**
 * Body variant used for sendBeacon, which cannot set custom headers.
 * Includes projectToken as a fallback auth mechanism.
 */
export interface EventBatchRequestWithToken extends EventBatchRequest {
  projectToken: string;
}

/**
 * Request body for POST /api/v1/goals — reports a single detected goal.
 */
export interface GoalReportRequest {
  type: GoalType;
  label: string;
  trigger: GoalTrigger;
  confidence: number;
}
