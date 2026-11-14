/* Copied verbatim from the CosmicPulse mobile app (src/engine/baseline.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { Measurement, Mission, MissionPhase, VitalType } from '@/data/types';

/**
 * Personal baselines.
 *
 * A baseline is this astronaut's own normal for a metric — never a population
 * range. It is computed with robust statistics (median and MAD) so a few
 * outliers or a sensor glitch cannot drag it, from a window chosen by mission
 * phase:
 *
 *  1. `phase`     — readings from the current mission phase once it has
 *                   lasted long enough (physiology re-settles after launch);
 *  2. `preflight` — readings collected before launch, while the in-flight
 *                   phase is still too young;
 *  3. `rolling`   — the most recent 30 days, as a last resort.
 *
 * The most recent `excludeRecentDays` are always excluded so a developing
 * change is compared against what came before it rather than absorbing it.
 */

const DAY = 86_400_000;

export const BASELINE_METRICS: VitalType[] = ['heart_rate', 'hrv', 'spo2', 'respiratory_rate', 'temperature', 'blood_pressure', 'weight', 'sleep'];

export type BaselineQuality = 'insufficient' | 'provisional' | 'established';

export type Baseline = {
  metric: VitalType;
  /** Robust centre (median) and spread (scaled MAD ≈ SD for normal data). */
  median: number;
  spread: number;
  /** For blood pressure: diastolic median. */
  median2?: number;
  p10: number;
  p90: number;
  n: number;
  coverageDays: number;
  quality: BaselineQuality;
  source: 'phase' | 'preflight' | 'rolling';
  phase: MissionPhase | 'preflight' | 'any';
  window: { from: string; to: string };
};

export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function quantile(xs: number[], q: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/** Median absolute deviation scaled to be comparable to a standard deviation. */
export function mad(xs: number[]): number {
  const m = median(xs);
  return 1.4826 * median(xs.map((x) => Math.abs(x - m)));
}

/** Smallest spread we will divide by, so very stable metrics do not create noisy z-scores. */
export const MIN_SPREAD: Partial<Record<VitalType, number>> = {
  heart_rate: 2,
  hrv: 4,
  spo2: 0.6,
  respiratory_rate: 1,
  temperature: 0.15,
  blood_pressure: 4,
  weight: 0.4,
  sleep: 0.4,
};

/** Days an in-flight phase must have run before it can serve as its own baseline. */
const PHASE_MIN_DAYS = 14;

export type BaselineOptions = { mission?: Pick<Mission, 'launchedAt' | 'phase'>; phaseStartedAt?: string; now?: number; excludeRecentDays?: number };

export function computeBaseline(all: Measurement[], metric: VitalType, opts: BaselineOptions = {}): Baseline {
  const now = opts.now ?? Date.now();
  const exclude = (opts.excludeRecentDays ?? 3) * DAY;
  const usable = all.filter((m) => m.type === metric && !m.qualityFlag && new Date(m.takenAt).getTime() <= now - exclude);
  const launched = opts.mission ? new Date(opts.mission.launchedAt).getTime() : undefined;
  const phaseStart = opts.phaseStartedAt ? new Date(opts.phaseStartedAt).getTime() : launched;

  const pick = (): { set: Measurement[]; source: Baseline['source']; phase: Baseline['phase'] } => {
    if (phaseStart !== undefined && now - phaseStart >= PHASE_MIN_DAYS * DAY) {
      const set = usable.filter((m) => new Date(m.takenAt).getTime() >= phaseStart);
      if (set.length >= 10) return { set, source: 'phase', phase: opts.mission?.phase ?? 'any' };
    }
    if (launched !== undefined) {
      const set = usable.filter((m) => new Date(m.takenAt).getTime() < launched);
      if (set.length >= 10) return { set, source: 'preflight', phase: 'preflight' };
    }
    return { set: usable.filter((m) => new Date(m.takenAt).getTime() >= now - 33 * DAY), source: 'rolling', phase: 'any' };
  };

  const { set, source, phase } = pick();
  const values = set.map((m) => m.value);
  const days = new Set(set.map((m) => m.takenAt.slice(0, 10))).size;
  const quality: BaselineQuality = values.length < 10 || days < 5 ? 'insufficient' : values.length < 20 || days < 10 ? 'provisional' : 'established';
  const times = set.map((m) => m.takenAt).sort();
  return {
    metric,
    median: median(values),
    spread: Math.max(mad(values) || 0, MIN_SPREAD[metric] ?? 0.5),
    median2: metric === 'blood_pressure' ? median(set.map((m) => m.value2 ?? NaN).filter((v) => !Number.isNaN(v))) : undefined,
    p10: quantile(values, 0.1),
    p90: quantile(values, 0.9),
    n: values.length,
    coverageDays: days,
    quality,
    source,
    phase,
    window: { from: times[0] ?? '', to: times[times.length - 1] ?? '' },
  };
}

export function computeBaselines(all: Measurement[], opts: BaselineOptions = {}): Partial<Record<VitalType, Baseline>> {
  const out: Partial<Record<VitalType, Baseline>> = {};
  for (const metric of BASELINE_METRICS) out[metric] = computeBaseline(all, metric, opts);
  return out;
}

export const BASELINE_SOURCE_COPY: Record<Baseline['source'], string> = {
  phase: 'From your readings in the current mission phase',
  preflight: 'From your pre-flight readings (current phase still settling)',
  rolling: 'From your last 30 days (no phase or pre-flight data)',
};
