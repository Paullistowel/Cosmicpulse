/* Copied verbatim from the CosmicPulse mobile app (src/data/demo/pool.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { Device, EnvironmentReading, ExerciseSession, Measurement, SleepRecord, VitalType } from '@/data/types';
import { applyCondition, type DemoConditionId } from './conditions';
import { buildScenario, type ScenarioId } from './scenarios';

/**
 * Demo data pool — the single source of simulated health data.
 *
 * Generated once from the seeded scenario generator (+ optional simulated
 * condition), persisted in the encrypted store, and regenerated only when it
 * is a day old, the scenario/condition changes, or the user resets it. So
 * values never change between renders or restarts, and every screen, chart,
 * summary, alert and AI answer reads the same records.
 *
 * `mergeDemo` is the only place simulated records enter the live dataset:
 * per metric, a simulated series is used ONLY when there is no real reading
 * of that metric (REAL / DEMO / MIXED). Real readings are never altered.
 */
export type DemoPool = {
  generatedAt: string;
  scenario: ScenarioId;
  condition: DemoConditionId;
  measurements: Measurement[];
  environment: EnvironmentReading[];
  sleepRecords: SleepRecord[];
  exercise: ExerciseSession[];
  devices: Device[];
};

export const POOL_MAX_AGE_MS = 24 * 3_600_000;

export const isSynthetic = (src: { kind: string }) => src.kind === 'simulated' || src.kind === 'demo';

export function buildPool(scenario: ScenarioId, condition: DemoConditionId, now = Date.now()): DemoPool {
  const d = buildScenario(scenario);
  const synthetic = d.measurements.filter((m) => isSynthetic(m.source));
  const c = applyCondition(synthetic, d.sleepRecords.filter((r) => isSynthetic(r.source)), condition, now);
  return {
    generatedAt: new Date(now).toISOString(),
    scenario,
    condition,
    measurements: c.measurements,
    environment: d.environment.filter((e) => isSynthetic(e.source)),
    sleepRecords: c.sleepRecords,
    exercise: d.exercise.filter((x) => isSynthetic(x.source)),
    devices: d.devices.filter((x) => x.simulated),
  };
}

export function poolIsStale(pool: DemoPool | undefined, scenario: ScenarioId, condition: DemoConditionId, now = Date.now()) {
  return !pool || pool.scenario !== scenario || pool.condition !== condition || now - new Date(pool.generatedAt).getTime() > POOL_MAX_AGE_MS;
}

type Live = { measurements: Measurement[]; environment: EnvironmentReading[]; sleepRecords: SleepRecord[]; exercise: ExerciseSession[]; devices: Device[] };

/** Real records + simulated fill-ins for metrics that have no real data. Pure. */
export function mergeDemo(live: Live, pool: DemoPool | undefined, enabled: boolean): Live {
  const real = live.measurements.filter((m) => !isSynthetic(m.source));
  const realSleepRecords = live.sleepRecords.filter((r) => !isSynthetic(r.source));
  const realTypes = new Set<VitalType>(real.map((m) => m.type));
  if (realSleepRecords.length) realTypes.add('sleep');
  if (!enabled || !pool) {
    return {
      measurements: real,
      environment: live.environment.filter((e) => !isSynthetic(e.source)),
      sleepRecords: realSleepRecords,
      exercise: live.exercise.filter((x) => !isSynthetic(x.source)),
      devices: live.devices.filter((d) => !d.simulated),
    };
  }
  const sim = pool.measurements.filter((m) => !realTypes.has(m.type));
  const simTypes = new Set(sim.map((m) => m.type));
  return {
    measurements: [...real, ...sim],
    environment: [...live.environment.filter((e) => !isSynthetic(e.source)), ...pool.environment],
    sleepRecords: realTypes.has('sleep') ? realSleepRecords : [...realSleepRecords, ...pool.sleepRecords],
    exercise: [...live.exercise.filter((x) => !isSynthetic(x.source)), ...pool.exercise],
    // Show a simulated device only while it still supplies at least one metric.
    devices: [...live.devices.filter((d) => !d.simulated), ...pool.devices.filter((d) => d.measures.some((t) => simTypes.has(t)))],
  };
}

/** Cheap equality on record ids + values so the store only updates when something changed. */
export function sameRecords<T extends { id: string }>(a: T[], b: T[]) {
  if (a.length !== b.length) return false;
  const m = new Map(a.map((x) => [x.id, x]));
  return b.every((x) => m.get(x.id) === x);
}
