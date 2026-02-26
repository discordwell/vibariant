import React, { createContext, useEffect, useRef, useState } from 'react';
import type { VibariantConfig } from '../types/index.js';
import { Vibariant } from '../core/client.js';

export interface VibariantContextValue {
  client: Vibariant | null;
  ready: boolean;
}

export const VibariantContext = createContext<VibariantContextValue>({
  client: null,
  ready: false,
});

export interface VibariantProviderProps {
  config: VibariantConfig;
  children: React.ReactNode;
}

/**
 * VibariantProvider: creates and initializes the Vibariant client,
 * providing it to all child components via React context.
 *
 * Usage:
 * ```tsx
 * <VibariantProvider config={{ projectToken: 'vv_proj_xxx' }}>
 *   <App />
 * </VibariantProvider>
 * ```
 */
export function VibariantProvider({ config, children }: VibariantProviderProps) {
  const clientRef = useRef<Vibariant | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const client = new Vibariant(config);
    clientRef.current = client;

    client.init().then(() => {
      setReady(true);
    }).catch((err) => {
      if (config.debug) {
        console.error('[Vibariant] Init failed:', err);
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
    <VibariantContext.Provider value={{ client: clientRef.current, ready }}>
      {children}
    </VibariantContext.Provider>
  );
}
