import type { TrackedEvent, EventItem, EventBatchRequest, EventBatchRequestWithToken } from '../types/index.js';
import type { ResolvedConfig } from './config.js';
import * as store from './store.js';

const PENDING_KEY = 'pending_events';

export class EventBatcher {
  private queue: TrackedEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private config: ResolvedConfig;
  private flushing = false;

  constructor(config: ResolvedConfig) {
    this.config = config;
    this.setupUnloadFlush();
  }

  /**
   * Start the periodic flush timer.
   */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.flush();
    }, this.config.batching.intervalMs);
  }

  /**
   * Stop the periodic flush timer.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Add an event to the queue. Automatically flushes if the queue
   * reaches maxSize.
   */
  enqueue(event: TrackedEvent): void {
    this.queue.push(event);
    if (this.config.debug) {
      console.debug('[Vibariant] Event queued:', event.type, event.payload);
    }
    if (this.queue.length >= this.config.batching.maxSize) {
      void this.flush();
    }
  }

  /**
   * Flush all queued events to the API.
   * Uses fetch for normal flushes, sendBeacon for unload.
   */
  async flush(useBeacon = false): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;

    this.flushing = true;
    const events = this.queue.splice(0);

    // Transform internal TrackedEvent objects to API-expected EventItem format (snake_case)
    const apiEvents: EventItem[] = events.map((e) => ({
      visitor_id: e.visitorId,
      session_id: e.sessionId,
      experiment_assignments: Object.keys(e.assignments).length > 0 ? e.assignments : null,
      event_type: e.type,
      payload: Object.keys(e.payload as Record<string, unknown>).length > 0 ? (e.payload as Record<string, unknown>) : null,
      timestamp: e.timestamp,
    }));

    const url = `${this.config.apiHost}/api/v1/events`;

    try {
      if (useBeacon && this.config.batching.useSendBeacon && typeof navigator?.sendBeacon === 'function') {
        // sendBeacon cannot set custom headers, so include projectToken in the body
        const beaconBody: EventBatchRequestWithToken = {
          projectToken: this.config.projectToken,
          events: apiEvents,
        };
        const blob = new Blob([JSON.stringify(beaconBody)], { type: 'application/json' });
        const sent = navigator.sendBeacon(url, blob);
        if (!sent) {
          // sendBeacon failed — persist for retry
          this.persistPending(events);
        }
      } else {
        const body: EventBatchRequest = { events: apiEvents };
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Project-Token': this.config.projectToken,
          },
          body: JSON.stringify(body),
          keepalive: true,
        });

        if (!response.ok) {
          // Server error — persist for retry
          this.persistPending(events);
          if (this.config.debug) {
            console.warn('[Vibariant] Flush failed:', response.status);
          }
        } else if (this.config.debug) {
          console.debug(`[Vibariant] Flushed ${events.length} events`);
        }
      }
    } catch {
      // Network error — persist for retry
      this.persistPending(events);
      if (this.config.debug) {
        console.warn('[Vibariant] Flush failed: network error');
      }
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Retry sending events that were persisted from previous failed flushes.
   */
  async retryPending(): Promise<void> {
    const pending = store.getJSON<TrackedEvent[]>(PENDING_KEY);
    if (!pending || pending.length === 0) return;

    // Clear the store before retrying to avoid infinite loops
    store.remove(PENDING_KEY);

    // Add them back to the queue
    for (const event of pending) {
      this.queue.push(event);
    }

    if (this.config.debug) {
      console.debug(`[Vibariant] Retrying ${pending.length} pending events`);
    }

    await this.flush();
  }

  /**
   * Get the current queue length (for testing / debugging).
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Persist events to localStorage for retry on next init.
   */
  private persistPending(events: TrackedEvent[]): void {
    const existing = store.getJSON<TrackedEvent[]>(PENDING_KEY) ?? [];
    // Cap at 100 pending events to avoid localStorage bloat
    const merged = [...existing, ...events].slice(-100);
    store.setJSON(PENDING_KEY, merged);
  }

  /**
   * Register beforeunload handler to flush remaining events via sendBeacon.
   */
  private setupUnloadFlush(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('beforeunload', () => {
      void this.flush(true);
    });

    // Also handle visibilitychange for mobile (where beforeunload is unreliable)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        void this.flush(true);
      }
    });
  }
}
