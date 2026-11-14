import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Ground-link state (web). Mirrors the mobile connectivity service:
 *  - network: browser online/offline events
 *  - ground:  /api/ground/status → the Next.js server pings the FastAPI
 *             ground server's /health (unauthenticated)
 *  - simulateLos: operator "loss of signal" switch that blocks EVERY ground
 *             request in this tab (ground client, sync, cloud assistant, OSDR).
 */
export type LinkState = 'online' | 'los_simulated' | 'no_network' | 'ground_unreachable' | 'not_configured';

type ConnState = {
  network: boolean;
  /** GROUND_API_URL is set on the web server. */
  configured: boolean;
  ground: boolean;
  groundVersion?: string;
  simulateLos: boolean;
  lastGroundContactAt?: string;
  lastCheckAt?: string;
  setSimulateLos: (v: boolean) => void;
};

export const useConnectivity = create<ConnState>()(
  persist(
    (set) => ({
      network: true,
      configured: false,
      ground: false,
      simulateLos: false,
      setSimulateLos: (v) => {
        set({ simulateLos: v });
        if (!v) void checkGround();
      },
    }),
    {
      name: 'cosmicpulse.link.v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ simulateLos: s.simulateLos, lastGroundContactAt: s.lastGroundContactAt }) as ConnState,
    },
  ),
);

export function linkState(s: Pick<ConnState, 'network' | 'ground' | 'simulateLos' | 'configured'> = useConnectivity.getState()): LinkState {
  if (s.simulateLos) return 'los_simulated';
  if (!s.network) return 'no_network';
  if (!s.configured) return 'not_configured';
  if (!s.ground) return 'ground_unreachable';
  return 'online';
}

/** May a network request leave this tab right now? (LOS simulation blocks everything.) */
export const networkAllowed = () => {
  const s = useConnectivity.getState();
  return !s.simulateLos && s.network;
};

export const canReachGround = () => {
  const s = useConnectivity.getState();
  return networkAllowed() && s.configured && s.ground;
};

export const LINK_COPY: Record<LinkState, { label: string; detail: string }> = {
  online: { label: 'Ground link', detail: 'Connected to the CosmicPulse ground server. Data syncs automatically.' },
  los_simulated: { label: 'Loss of signal (simulated)', detail: 'All network calls are blocked. Monitoring, alerts and the evidence library keep working on board; changes queue for later.' },
  no_network: { label: 'Offline', detail: 'No network. Running on board — data is stored locally and queued until the link returns.' },
  ground_unreachable: { label: 'Ground unreachable', detail: 'The web server cannot reach the ground server. Retrying every 30 s.' },
  not_configured: { label: 'Standalone', detail: 'No ground server configured (GROUND_API_URL). All processing is on board; nothing leaves this browser.' },
};

let inflight: Promise<boolean> | null = null;

export function checkGround(): Promise<boolean> {
  if (!networkAllowed()) {
    useConnectivity.setState({ ground: false, lastCheckAt: new Date().toISOString() });
    return Promise.resolve(false);
  }
  inflight ??= (async () => {
    try {
      const res = await fetch('/api/ground/status', { cache: 'no-store', signal: AbortSignal.timeout(7000) });
      const j = (await res.json()) as { configured: boolean; reachable: boolean; version?: string };
      const now = new Date().toISOString();
      useConnectivity.setState({ configured: j.configured, ground: j.reachable, groundVersion: j.version, lastCheckAt: now, ...(j.reachable ? { lastGroundContactAt: now } : {}) });
      return j.reachable;
    } catch {
      useConnectivity.setState({ ground: false, lastCheckAt: new Date().toISOString() });
      return false;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

let started = false;
export function startConnectivity(onRegained: () => void): () => void {
  if (started || typeof window === 'undefined') return () => {};
  started = true;
  let wasOnline = linkState() === 'online';
  const evaluate = () => {
    const now = linkState() === 'online';
    if (now && !wasOnline) onRegained();
    wasOnline = now;
  };
  const net = () => {
    useConnectivity.setState({ network: navigator.onLine });
    void checkGround().then(evaluate);
  };
  useConnectivity.setState({ network: navigator.onLine });
  window.addEventListener('online', net);
  window.addEventListener('offline', net);
  const unsub = useConnectivity.subscribe(evaluate);
  const interval = setInterval(() => void checkGround().then(evaluate), 30_000);
  void checkGround().then(evaluate);
  return () => {
    started = false;
    window.removeEventListener('online', net);
    window.removeEventListener('offline', net);
    unsub();
    clearInterval(interval);
  };
}
