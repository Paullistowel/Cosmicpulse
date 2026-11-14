/* Copied verbatim from the CosmicPulse mobile app (src/engine/activity.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { ActivityDay, ActivityPrefs, ActivitySource, DistanceKind, GpsSession } from '@/data/activity';

/**
 * Activity intelligence — deterministic, offline, pure.
 *
 * Every number shown in the app or handed to the AI is computed here from
 * stored records; the AI only explains results, it never calculates them.
 *
 * De-duplication: platform records are already aggregated across devices by
 * HealthKit / Health Connect statistics queries (which apply the platform's
 * own source priority), so a day is never summed across our sources. We pick
 * one source per day: real platform data > demo. GPS distance is used only on
 * days with no device-measured distance (otherwise the phone/watch already
 * counted that walk). Step-based distance is a last resort and is labelled
 * "estimated" everywhere.
 */

export const DEFAULT_STEP_GOAL = 8000;
/** Generic adult walking stride, metres — used only when nothing better is known. */
export const DEFAULT_STRIDE_M = 0.72;
const DAY_MS = 86_400_000;

// Phone platforms first (they already merge watch + phone); cloud wearables next; GPS-only days; demo last.
const SOURCE_RANK: Record<ActivitySource, number> = { healthkit: 0, health_connect: 0, fitbit: 1, garmin: 1, gps: 2, demo: 3 };

export type ResolvedDay = {
  date: string;
  source: ActivitySource;
  steps: number;
  distanceM: number;
  distanceKind: DistanceKind;
  activeKcal?: number;
  exerciseMin?: number;
  origins: string[];
};

/** Local calendar key YYYY-MM-DD. */
export function dateKey(d: Date | number): string {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Walking stride from height (≈ 0.414 × height). An estimate — label it. */
export function strideFromHeight(heightCm: number): number {
  return Math.round(heightCm * 0.414) / 100;
}

export function effectiveStride(prefs: ActivityPrefs): { strideM: number; source: 'user' | 'height' | 'default' } {
  if (prefs.strideM && prefs.strideM >= 0.3 && prefs.strideM <= 1.5) return { strideM: prefs.strideM, source: prefs.strideSource ?? 'user' };
  return { strideM: DEFAULT_STRIDE_M, source: 'default' };
}

/**
 * One record per date: best source wins (never a sum across sources), then
 * distance is resolved measured → GPS → estimated from steps.
 */
export function resolveDays(days: ActivityDay[], gps: GpsSession[], prefs: ActivityPrefs, opts: { includeDemo?: boolean } = {}): ResolvedDay[] {
  const includeDemo = opts.includeDemo ?? true;
  const best = new Map<string, ActivityDay>();
  for (const d of days) {
    if (d.source === 'demo' && !includeDemo) continue;
    const prev = best.get(d.date);
    if (!prev || SOURCE_RANK[d.source] < SOURCE_RANK[prev.source] || (SOURCE_RANK[d.source] === SOURCE_RANK[prev.source] && d.syncedAt > prev.syncedAt)) best.set(d.date, d);
  }
  const gpsByDay = new Map<string, number>();
  for (const s of gps) gpsByDay.set(dateKey(new Date(s.start)), (gpsByDay.get(dateKey(new Date(s.start))) ?? 0) + s.distanceM);

  const { strideM } = effectiveStride(prefs);
  const keys = new Set([...best.keys(), ...gpsByDay.keys()]);
  const out: ResolvedDay[] = [];
  for (const date of keys) {
    const d = best.get(date);
    const steps = Math.max(0, Math.round(d?.steps ?? 0));
    let distanceM = 0;
    let distanceKind: DistanceKind = 'none';
    if (d?.distanceM !== undefined && d.distanceM > 0) {
      distanceM = d.distanceM;
      distanceKind = 'measured';
    } else if (gpsByDay.get(date)) {
      distanceM = gpsByDay.get(date)!;
      distanceKind = 'gps';
    } else if (steps > 0) {
      distanceM = steps * strideM;
      distanceKind = 'estimated';
    }
    out.push({
      date,
      source: d?.source ?? 'gps',
      steps,
      distanceM,
      distanceKind,
      activeKcal: d?.activeKcal,
      exerciseMin: d?.exerciseMin,
      origins: d?.origins ?? ['GPS session'],
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/* --------------------------------- Periods --------------------------------- */

export type Period = 'day' | 'week' | 'month' | 'year' | 'lifetime';

export const PERIOD_LABEL: Record<Period, string> = { day: 'Today', week: 'This week', month: 'This month', year: 'This year', lifetime: 'All time' };

/** Calendar periods (weeks start Monday). `end` is exclusive and capped at the end of today. */
export function periodRange(period: Period, now: number, firstDate?: string): { start: Date; end: Date } {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const end = new Date(today.getTime() + DAY_MS);
  switch (period) {
    case 'day':
      return { start: today, end };
    case 'week': {
      const dow = (today.getDay() + 6) % 7;
      return { start: new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow), end };
    }
    case 'month':
      return { start: new Date(today.getFullYear(), today.getMonth(), 1), end };
    case 'year':
      return { start: new Date(today.getFullYear(), 0, 1), end };
    case 'lifetime':
      return { start: firstDate ? keyToDate(firstDate) : today, end };
  }
}

/** The equivalent full previous period (previous calendar day/week/month/year). */
export function previousRange(period: Period, now: number): { start: Date; end: Date } | null {
  const cur = periodRange(period, now);
  const s = cur.start;
  switch (period) {
    case 'day':
      return { start: new Date(s.getFullYear(), s.getMonth(), s.getDate() - 1), end: s };
    case 'week':
      return { start: new Date(s.getFullYear(), s.getMonth(), s.getDate() - 7), end: s };
    case 'month':
      return { start: new Date(s.getFullYear(), s.getMonth() - 1, 1), end: s };
    case 'year':
      return { start: new Date(s.getFullYear() - 1, 0, 1), end: s };
    default:
      return null;
  }
}

export type Totals = {
  steps: number;
  distanceM: number;
  /** Metres by provenance — the UI and AI must say how much is estimated. */
  distanceBy: Record<Exclude<DistanceKind, 'none'>, number>;
  activeKcal: number;
  exerciseMin: number;
  daysWithData: number;
  avgStepsPerDay: number;
  avgDistancePerDayM: number;
};

function totals(days: ResolvedDay[]): Totals {
  const distanceBy = { measured: 0, gps: 0, estimated: 0 };
  let steps = 0;
  let activeKcal = 0;
  let exerciseMin = 0;
  let distanceM = 0;
  for (const d of days) {
    steps += d.steps;
    distanceM += d.distanceM;
    if (d.distanceKind !== 'none') distanceBy[d.distanceKind] += d.distanceM;
    activeKcal += d.activeKcal ?? 0;
    exerciseMin += d.exerciseMin ?? 0;
  }
  const n = days.length;
  return { steps, distanceM, distanceBy, activeKcal, exerciseMin, daysWithData: n, avgStepsPerDay: n ? steps / n : 0, avgDistancePerDayM: n ? distanceM / n : 0 };
}

export type PeriodSummary = Totals & {
  period: Period;
  start: string;
  end: string;
  /** Calendar days elapsed in the period (including today). */
  daysElapsed: number;
  mostActive?: { date: string; steps: number };
  /** Share of days with data that met the step goal (0–1). */
  consistency: number;
  goal: number;
  /** Today's steps ÷ goal (0–∞); for longer periods, average day ÷ goal. */
  goalProgress: number;
  previous?: Totals;
  /** Relative change in average steps/day vs the previous period, or undefined if no prior data. */
  changePct?: number;
  /** True when any part of the distance total is estimated from steps. */
  distanceEstimated: boolean;
  series: ResolvedDay[];
};

const inRange = (d: ResolvedDay, r: { start: Date; end: Date }) => {
  const t = keyToDate(d.date).getTime();
  return t >= r.start.getTime() && t < r.end.getTime();
};

export function summarize(resolved: ResolvedDay[], period: Period, now: number, prefs: ActivityPrefs): PeriodSummary {
  const goal = prefs.stepGoal || DEFAULT_STEP_GOAL;
  const range = periodRange(period, now, resolved[0]?.date);
  const days = resolved.filter((d) => inRange(d, range));
  const t = totals(days);
  const prevRange = previousRange(period, now);
  const prevDays = prevRange ? resolved.filter((d) => inRange(d, prevRange)) : [];
  const previous = prevDays.length ? totals(prevDays) : undefined;
  const most = days.reduce<ResolvedDay | undefined>((m, d) => (!m || d.steps > m.steps ? d : m), undefined);
  const daysElapsed = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / DAY_MS));
  return {
    ...t,
    period,
    start: dateKey(range.start),
    end: dateKey(range.end.getTime() - DAY_MS),
    daysElapsed,
    mostActive: most && most.steps > 0 ? { date: most.date, steps: most.steps } : undefined,
    consistency: days.length ? days.filter((d) => d.steps >= goal).length / days.length : 0,
    goal,
    goalProgress: period === 'day' ? t.steps / goal : t.avgStepsPerDay / goal,
    previous,
    changePct: previous && previous.avgStepsPerDay > 0 && t.daysWithData ? (t.avgStepsPerDay - previous.avgStepsPerDay) / previous.avgStepsPerDay : undefined,
    distanceEstimated: t.distanceBy.estimated > 0,
    series: days,
  };
}

/* -------------------------------- Formatting -------------------------------- */

export function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 2 : 1)} km`;
}

export const DISTANCE_KIND_LABEL: Record<DistanceKind, string> = {
  measured: 'Measured by device',
  gps: 'GPS session',
  estimated: 'Estimated from steps',
  none: 'No distance data',
};

/** Short provenance line for a period total, e.g. "measured" / "partly estimated from steps". */
export function distanceProvenance(t: Pick<Totals, 'distanceBy' | 'distanceM'>): string {
  if (!t.distanceM) return 'no distance data';
  const { measured, gps, estimated } = t.distanceBy;
  if (estimated === 0) return gps > 0 && measured === 0 ? 'from GPS sessions' : gps > 0 ? 'measured by device + GPS sessions' : 'measured by device';
  if (measured + gps === 0) return 'estimated from steps';
  return `partly estimated from steps (${fmtDistance(estimated)} of ${fmtDistance(t.distanceM)})`;
}

/* ---------------------------------- Demo ----------------------------------- */

/**
 * Deterministic synthetic activity for demo mode. Always `source: 'demo'`
 * and labelled SIMULATED in the UI; hidden once real platform data exists.
 */
export function demoActivity(now: number, days = 120): ActivityDay[] {
  const out: ActivityDay[] = [];
  const syncedAt = new Date(now).toISOString();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * DAY_MS);
    const seed = Math.sin((d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate()) * 12.9898) * 43758.5453;
    const r = seed - Math.floor(seed);
    const dow = d.getDay();
    const base = dow === 0 || dow === 6 ? 6200 : 8400;
    // Today is partial: scale by the fraction of the day elapsed.
    const frac = i === 0 ? Math.min(1, (d.getHours() * 60 + d.getMinutes()) / (20 * 60)) : 1;
    const steps = Math.round((base + (r - 0.5) * 5200) * frac);
    out.push({
      date: dateKey(d),
      source: 'demo',
      steps,
      // No distance: simulated data must never be labelled "measured by device";
      // the engine shows it as estimated from steps.
      activeKcal: Math.round(steps * 0.045 + 180 * frac),
      exerciseMin: Math.round((35 + r * 50) * frac),
      origins: ['Simulated treadmill + biomonitor'],
      syncedAt,
    });
  }
  return out;
}
