import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Measurement } from '@/data/types';
import { useHealth } from '@/store/health';
import { canReachGround } from './connectivity';
import { ground, GroundError } from './ground';
import { isAstronautSession, useSession } from './session';

/**
 * LIVE DEVICE DATA (mode 1) — via the existing CosmicPulse architecture.
 *
 * A web browser cannot use Apple HealthKit or pair an Apple Watch. The native
 * CosmicPulse iPhone app reads HealthKit (Apple Watch data arrives through the
 * iPhone's Health app), normalises each reading and pushes it to the ground
 * server through the authenticated sync outbox (`POST /sync/push`). This web
 * app, signed in as the same astronaut, pulls those readings with
 * `GET /astronauts/{id}/vitals` and keeps their original provenance
 * (device name, provider, measurement time, sync time).
 */

type DeviceLinkState = {
  lastPullAt?: string;
  lastPullCount?: number;
  lastError?: string;
  /** Distinct device/provider names seen in pulled readings. */
  sources: string[];
  pulling: boolean;
};

export const useDeviceLink = create<DeviceLinkState>()(
  persist(() => ({ sources: [], pulling: false }) as DeviceLinkState, {
    name: 'cosmicpulse.devicelink.v1',
    storage: createJSONStorage(() => localStorage),
    partialize: (s) => ({ ...s, pulling: false }),
  }),
);

const PROVIDER_LABEL: Record<string, string> = { healthkit: 'Apple Health', health_connect: 'Health Connect', fitbit: 'Fitbit', garmin: 'Garmin', ble: 'Bluetooth sensor', manual: 'Manual entry' };

export function providerLabel(m: Measurement): string {
  if (m.provider && PROVIDER_LABEL[m.provider]) return PROVIDER_LABEL[m.provider];
  if (m.source.kind === 'live' || m.source.kind === 'synced' || m.source.kind === 'simulated') return m.source.deviceName;
  return m.source.kind;
}

/** Pull phone-synced readings from ground. Returns the number of new readings. */
export async function pullGroundVitals(opts: { days?: number } = {}): Promise<number> {
  const user = useSession.getState().user;
  if (!isAstronautSession() || !user?.astronautId) throw new GroundError(0, 'Sign in with an astronaut account to receive device data.', 'auth');
  if (!canReachGround()) throw new GroundError(0, 'No ground link.', 'offline');
  const st = useDeviceLink.getState();
  const from = st.lastPullAt && !opts.days ? new Date(new Date(st.lastPullAt).getTime() - 6 * 3_600_000) : new Date(Date.now() - (opts.days ?? 90) * 86_400_000);
  useDeviceLink.setState({ pulling: true });
  try {
    const r = await ground<{ measurements: Measurement[] }>(`/astronauts/${encodeURIComponent(user.astronautId)}/vitals?from=${encodeURIComponent(from.toISOString())}&limit=5000`);
    const now = new Date().toISOString();
    // Readings this browser created (manual / Web Bluetooth) come back too; upsert-by-id keeps one copy.
    const incoming = r.measurements
      .filter((m) => m && m.id && m.type && Number.isFinite(m.value) && m.source?.kind !== 'simulated' && m.source?.kind !== 'demo')
      .map((m) => ({ ...m, syncedAt: m.syncedAt ?? now }));
    const added = useHealth.getState().upsertMeasurements(incoming);
    const names = new Set(st.sources);
    incoming.forEach((m) => names.add(providerLabel(m)));
    useDeviceLink.setState({ lastPullAt: now, lastPullCount: added, lastError: undefined, sources: [...names].filter((n) => n !== 'manual').slice(0, 12), pulling: false });
    return added;
  } catch (e) {
    useDeviceLink.setState({ lastError: (e as Error).message, pulling: false });
    throw e;
  }
}
