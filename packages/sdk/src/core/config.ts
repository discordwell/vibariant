import type { VibeVariantConfig, BatchingConfig } from '../types/index.js';

export const DEFAULT_BATCHING: BatchingConfig = {
  maxSize: 10,
  intervalMs: 5000,
  useSendBeacon: true,
};

export const DEFAULT_CONFIG = {
  apiHost: 'https://api.vibevariant.com',
  autoTrack: true,
  autoGoals: true,
  debug: false,
} as const;

export interface ResolvedConfig {
  projectToken: string;
  apiHost: string;
  autoTrack: boolean;
  autoGoals: boolean;
  visitorId?: string;
  attributes: Record<string, string | number | boolean>;
  batching: BatchingConfig;
  debug: boolean;
}

/**
 * Merge user-supplied config with defaults.
 * Throws if projectToken is missing.
 */
export function applyDefaults(config: VibeVariantConfig): ResolvedConfig {
  if (!config.projectToken) {
    throw new Error('[VibeVariant] projectToken is required');
  }

  return {
    projectToken: config.projectToken,
    apiHost: config.apiHost ?? DEFAULT_CONFIG.apiHost,
    autoTrack: config.autoTrack ?? DEFAULT_CONFIG.autoTrack,
    autoGoals: config.autoGoals ?? DEFAULT_CONFIG.autoGoals,
    visitorId: config.visitorId,
    attributes: config.attributes ?? {},
    batching: {
      ...DEFAULT_BATCHING,
      ...config.batching,
    },
    debug: config.debug ?? DEFAULT_CONFIG.debug,
  };
}
