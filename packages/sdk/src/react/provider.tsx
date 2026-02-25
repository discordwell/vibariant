import React, { createContext, useEffect, useRef, useState } from 'react';
import type { VibeVariantConfig } from '../types/index.js';
import { VibeVariant } from '../core/client.js';

export interface VibeVariantContextValue {
  client: VibeVariant | null;
  ready: boolean;
}

export const VibeVariantContext = createContext<VibeVariantContextValue>({
  client: null,
  ready: false,
});

export interface VibeVariantProviderProps {
  config: VibeVariantConfig;
  children: React.ReactNode;
}

/**
 * VibeVariantProvider: creates and initializes the VibeVariant client,
 * providing it to all child components via React context.
 *
 * Usage:
 * ```tsx
 * <VibeVariantProvider config={{ projectToken: 'vv_proj_xxx' }}>
 *   <App />
 * </VibeVariantProvider>
 * ```
 */
export function VibeVariantProvider({ config, children }: VibeVariantProviderProps) {
  const clientRef = useRef<VibeVariant | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const client = new VibeVariant(config);
    clientRef.current = client;

    client.init().then(() => {
      setReady(true);
    }).catch((err) => {
      if (config.debug) {
        console.error('[VibeVariant] Init failed:', err);
      }
      // Still set ready so the app doesn't hang — local assignments will work
      setReady(true);
    });

    return () => {
      void client.destroy();
      clientRef.current = null;
    };
    // Config is intentionally only read on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.projectToken]);

  return (
    <VibeVariantContext.Provider value={{ client: clientRef.current, ready }}>
      {children}
    </VibeVariantContext.Provider>
  );
}
