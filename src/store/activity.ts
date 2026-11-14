import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ActivityDay, ActivityPrefs, ActivitySource } from '@/data/activity';
import type { Measurement } from '@/data/types';
import { DEFAULT_STEP_GOAL, dateKey, demoActivity, resolveDays, type ResolvedDay } from '@/engine/activity';
import { useNow } from '@/hooks/use-now';
import { useHealth } from './health';
import { useSettings } from './settings';
import { vaultStorage } from './vault';

/**
 * Activity (web). Sources, in priority order:
 *  1. Daily step totals synced from the phone (HealthKit / Health Connect via
 *     the ground server) — `steps` measurements with a provider.
 *  2. Manual activity entries made here.
 *  3. Labelled SIMULATED activity when the simulation source is on and no real
 *     activity exists (same generator as the mobile app).
 */
export type WebActivitySource = ActivitySource | 'manual';
export type ManualActivity = Omit<ActivityDay, 'source' | 'origins' | 'syncedAt'> & { id: string; source: 'manual'; origins: string[]; syncedAt: string; note?: string };

type ActivityState = {
  manual: ManualActivity[];
  prefs: ActivityPrefs;
  addManual: (d: { date: string; steps?: number; distanceM?: number; exerciseMin?: number; activeKcal?: number; note?: string }) => void;
  deleteManual: (id: string) => void;
  setPrefs: (p: Partial<ActivityPrefs>) => void;
};

export const useActivity = create<ActivityState>()(
  persist(
    (set) => ({
      manual: [],
      prefs: { stepGoal: DEFAULT_STEP_GOAL },
      addManual: (d) =>
        set((s) => ({
          manual: [...s.manual.filter((x) => x.date !== d.date), { id: `act-${d.date}`, source: 'manual' as const, origins: ['Manual entry'], syncedAt: new Date().toISOString(), ...d }].sort((a, b) => a.date.localeCompare(b.date)),
        })),
      deleteManual: (id) => set((s) => ({ manual: s.manual.filter((x) => x.id !== id) })),
      setPrefs: (p) => set((s) => ({ prefs: { ...s.prefs, ...p } })),
    }),
    { name: 'cosmicpulse.activity.v1', storage: createJSONStorage(() => vaultStorage), version: 1, skipHydration: true },
  ),
);

const PROVIDER_SOURCE: Record<string, ActivitySource> = { healthkit: 'healthkit', health_connect: 'health_connect', fitbit: 'fitbit', garmin: 'garmin' };

/** Daily totals from synced `steps` measurements (one per day; the largest total wins). */
export function syncedDays(ms: Measurement[]): ActivityDay[] {
  const best = new Map<string, ActivityDay>();
  for (const m of ms) {
    if (m.type !== 'steps' || m.source.kind === 'simulated' || m.source.kind === 'demo' || m.source.kind === 'manual') continue;
    const date = dateKey(new Date(m.takenAt));
    const source = PROVIDER_SOURCE[m.provider ?? ''] ?? 'healthkit';
    const prev = best.get(date);
    if (!prev || (prev.steps ?? 0) < m.value) best.set(date, { date, source, steps: Math.round(m.value), origins: [m.source.kind === 'synced' || m.source.kind === 'live' ? m.source.deviceName : 'Synced'], syncedAt: m.syncedAt ?? m.takenAt });
  }
  return [...best.values()];
}

export function resolveActivity(input: { measurements: Measurement[]; manual: ManualActivity[]; prefs: ActivityPrefs; demo: boolean; now: number }): { days: ResolvedDay[]; demo: boolean; real: boolean } {
  const synced = syncedDays(input.measurements);
  const real = synced.length > 0 || input.manual.length > 0;
  const days = [...synced, ...(input.manual as unknown as ActivityDay[])];
  const showDemo = !real && input.demo;
  const source = showDemo ? demoActivity(input.now) : days;
  return { days: resolveDays(source, [], input.prefs, { includeDemo: showDemo }), demo: showDemo, real };
}

export function useResolvedActivity() {
  const now = useNow(60_000);
  const measurements = useHealth((s) => s.measurements);
  const manual = useActivity((s) => s.manual);
  const prefs = useActivity((s) => s.prefs);
  const demo = useSettings((s) => s.demoFallback);
  const dayKey = new Date(now).toDateString();
  return useMemo(
    () => resolveActivity({ measurements, manual, prefs, demo, now }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [measurements, manual, prefs, demo, dayKey],
  );
}

export function resolvedActivityNow(now = Date.now()) {
  const a = useActivity.getState();
  return resolveActivity({ measurements: useHealth.getState().measurements, manual: a.manual, prefs: a.prefs, demo: useSettings.getState().demoFallback, now });
}
