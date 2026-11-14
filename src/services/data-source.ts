import { useMemo } from 'react';

import type { Measurement, VitalType } from '@/data/types';
import { VITAL_META } from '@/data/vitals';
import { useResolvedActivity } from '@/store/activity';
import { useHealth } from '@/store/health';
import { useSettings } from '@/store/settings';
import { useConnectivity } from './connectivity';
import { useDeviceLink } from './device-data';
import { useSession } from './session';
import { useBle } from './web-bluetooth';

/**
 * Data Source Manager (web port of the mobile summarise()).
 *  REAL  — every tracked metric with data comes from real sources
 *  DEMO  — no real readings; everything shown is SYNTHETIC
 *  MIXED — real readings for some metrics, synthetic fill-ins for others
 * Real readings always take priority per metric; synthetic data never
 * overwrites them.
 */
export type DataState = 'real' | 'demo' | 'mixed' | 'empty';
export const TRACKED: VitalType[] = ['heart_rate', 'hrv', 'spo2', 'respiratory_rate', 'temperature', 'blood_pressure', 'sleep', 'weight', 'glucose'];

export type ModeBreakdown = { live: number; synced: number; manual: number; synthetic: number; clinician: number };

export type DataSourceSummary = {
  state: DataState;
  real: VitalType[];
  simulated: VitalType[];
  missing: VitalType[];
  breakdown: ModeBreakdown;
  activity: 'real' | 'simulated' | 'none';
  simulationOn: boolean;
  groundSignedIn: boolean;
  lastDeviceSyncAt?: string;
  bleConnected: boolean;
  reason?: string;
};

const synthetic = (m: Measurement) => m.source.kind === 'simulated' || m.source.kind === 'demo';

export function summarise(i: { measurements: Measurement[]; activityReal: boolean; activityDemo: boolean; simulationOn: boolean; signedIn: boolean; lastDeviceSyncAt?: string; bleConnected: boolean }): DataSourceSummary {
  const real = new Set<VitalType>();
  const sim = new Set<VitalType>();
  const b: ModeBreakdown = { live: 0, synced: 0, manual: 0, synthetic: 0, clinician: 0 };
  for (const m of i.measurements) {
    if (synthetic(m)) {
      sim.add(m.type);
      b.synthetic++;
    } else {
      real.add(m.type);
      if (m.source.kind === 'live') b.live++;
      else if (m.source.kind === 'synced') b.synced++;
      else if (m.source.kind === 'clinician') b.clinician++;
      else b.manual++;
    }
  }
  const realList = TRACKED.filter((t) => real.has(t));
  const simList = TRACKED.filter((t) => !real.has(t) && sim.has(t));
  const missing = TRACKED.filter((t) => !real.has(t) && !sim.has(t));
  const anyReal = realList.length > 0 || i.activityReal;
  const anySim = simList.length > 0 || i.activityDemo;
  const state: DataState = anyReal && anySim ? 'mixed' : anyReal ? 'real' : anySim ? 'demo' : 'empty';
  let reason: string | undefined;
  if (anySim) {
    reason = i.signedIn
      ? 'no synced or manual readings exist yet for these metrics'
      : 'no wearable data is connected (Apple Health reaches the web only through the CosmicPulse iPhone app and ground sync)';
  }
  return { state, real: realList, simulated: simList, missing, breakdown: b, activity: i.activityReal ? 'real' : i.activityDemo ? 'simulated' : 'none', simulationOn: i.simulationOn, groundSignedIn: i.signedIn, lastDeviceSyncAt: i.lastDeviceSyncAt, bleConnected: i.bleConnected, reason };
}

export function useDataSource(): DataSourceSummary {
  const measurements = useHealth((s) => s.measurements);
  const act = useResolvedActivity();
  const sim = useSettings((s) => s.demoFallback);
  const user = useSession((s) => s.user);
  const lastPull = useDeviceLink((s) => s.lastPullAt);
  const ble = useBle((s) => s.status);
  useConnectivity((s) => s.ground);
  return useMemo(
    () => summarise({ measurements, activityReal: act.real, activityDemo: act.demo, simulationOn: sim, signedIn: !!user, lastDeviceSyncAt: lastPull, bleConnected: ble === 'connected' }),
    [measurements, act.real, act.demo, sim, user, lastPull, ble],
  );
}

export const metricList = (ts: VitalType[]) => ts.map((t) => VITAL_META[t].shortLabel).join(', ');

export const STATE_COPY: Record<DataState, { label: string; short: string; tone: 'success' | 'demo' | 'warning' | 'neutral'; detail: string }> = {
  real: { label: 'Real data', short: 'REAL', tone: 'success', detail: 'Every metric shown comes from device, synced, manual or clinician sources.' },
  demo: { label: 'Simulation mode', short: 'SYNTHETIC', tone: 'demo', detail: 'All readings are SYNTHETIC demo telemetry — not real astronaut measurements.' },
  mixed: { label: 'Mixed data', short: 'MIXED', tone: 'warning', detail: 'Real readings where available; SYNTHETIC telemetry fills metrics without real data.' },
  empty: { label: 'No data', short: 'NO DATA', tone: 'neutral', detail: 'No readings yet. Record a measurement, connect a device, or turn on simulation.' },
};
