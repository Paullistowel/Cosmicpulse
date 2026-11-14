/* Copied verbatim from the CosmicPulse mobile app (src/features/health/vitals.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { Insight, Measurement, MissionPhase, VitalType } from '@/data/types';
import { VITAL_META, displayUnit, toDisplay, type UnitPrefs } from '@/data/vitals';
import type { Baseline, MissionRules } from '@/engine';
import type { Tone } from '@/theme';

/**
 * Astronaut vital-sign helpers shared by Home, Health, the vital detail page
 * and measurement entry. Pure functions only — screens read engine output via
 * `useEngine()` and pass it in.
 */

const DAY = 86_400_000;
const MIN = 60_000;

/** The six vitals the crew dashboard always shows, in display order. */
export const CORE_VITALS: VitalType[] = ['heart_rate', 'hrv', 'spo2', 'blood_pressure', 'temperature', 'respiratory_rate'];

/** Vitals an astronaut can enter by hand (ECG only ever comes from a device). */
export const MANUAL_VITALS: VitalType[] = ['heart_rate', 'hrv', 'blood_pressure', 'spo2', 'respiratory_rate', 'temperature', 'weight'];

/** Sensor data younger than this is considered "live" and may pulse. */
export const LIVE_WINDOW_MS = 5 * MIN;

export const PHASE_LABEL: Record<MissionPhase | 'preflight' | 'any', string> = {
  preflight: 'Pre-flight',
  launch: 'Launch',
  early_flight: 'Early flight',
  steady_state: 'Steady state',
  eva_ops: 'EVA operations',
  late_mission: 'Late mission',
  return: 'Return',
  postflight: 'Post-flight',
  any: 'Any phase',
};

export const BASELINE_QUALITY: Record<Baseline['quality'], { label: string; tone: Tone }> = {
  established: { label: 'Established', tone: 'success' },
  provisional: { label: 'Provisional', tone: 'warning' },
  insufficient: { label: 'Insufficient data', tone: 'neutral' },
};

/** Readings are never shown from the future (demo schedules can pre-date them); allow 1 min of clock skew. */
export const notFuture = (iso: string, now: number) => new Date(iso).getTime() <= now + MIN;

export function latestOf(ms: Measurement[], type: VitalType, now: number): Measurement | undefined {
  let best: Measurement | undefined;
  for (const m of ms) if (m.type === type && notFuture(m.takenAt, now) && (!best || m.takenAt > best.takenAt)) best = m;
  return best;
}

export function seriesOf(ms: Measurement[], type: VitalType, now: number): Measurement[] {
  return ms.filter((m) => m.type === type && notFuture(m.takenAt, now)).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}

export const isDeviceSource = (m: Pick<Measurement, 'source'>) => m.source.kind === 'live' || m.source.kind === 'synced' || m.source.kind === 'simulated';

/**
 * True when a sensor reading is fresh enough to show a live pulse. Manual
 * entries never pulse, and neither do readings synced from Apple Health /
 * Health Connect: those are historical copies, not a live stream.
 */
export function isLiveReading(m: Pick<Measurement, 'source' | 'takenAt'> | undefined, now: number): boolean {
  if (!m || (m.source.kind !== 'live' && m.source.kind !== 'simulated')) return false;
  const age = now - new Date(m.takenAt).getTime();
  return age >= 0 && age < LIVE_WINDOW_MS;
}

export function fmtNum(type: VitalType, v: number, units?: UnitPrefs): string {
  const d = units ? toDisplay(type, v, units) : v;
  return d.toFixed(VITAL_META[type].decimals);
}

export function fmtReading(m: Pick<Measurement, 'type' | 'value' | 'value2'>, units: UnitPrefs): string {
  if (m.type === 'blood_pressure') return `${Math.round(m.value)}/${Math.round(m.value2 ?? 0)}`;
  return fmtNum(m.type, m.value, units);
}

export const unitOf = (type: VitalType, units: UnitPrefs) => displayUnit(type, units);

/* --------------------------------- Baseline -------------------------------- */

export type BaselineDelta = {
  /** Display text, e.g. "+6 bpm vs baseline" or "Within your usual range". */
  text: string;
  shift: number;
  z: number;
  within: boolean;
  tone: Tone;
};

/**
 * Compares a reading with the personal baseline. Returns null when the
 * baseline is missing or insufficient — callers must say so instead of
 * inventing a comparison.
 */
export function baselineDelta(m: Pick<Measurement, 'type' | 'value'> | undefined, b: Baseline | undefined, units: UnitPrefs): BaselineDelta | null {
  if (!m || !b || b.quality === 'insufficient' || !Number.isFinite(b.median)) return null;
  const shift = m.value - b.median;
  const z = shift / (b.spread || 1);
  const within = m.value >= b.p10 && m.value <= b.p90;
  const unit = unitOf(m.type, units);
  const scale = m.type === 'temperature' && units.system === 'us' ? 9 / 5 : m.type === 'weight' && units.system === 'us' ? 2.20462 : 1;
  const shown = shift * scale;
  const dec = VITAL_META[m.type].decimals;
  const rounded = Number(shown.toFixed(dec));
  const text = within ? 'Within your usual range' : `${rounded > 0 ? '+' : ''}${rounded.toFixed(dec)} ${unit} vs baseline`;
  const tone: Tone = within ? 'success' : Math.abs(z) >= 2.5 ? 'warning' : 'info';
  return { text, shift, z, within, tone };
}

/* ------------------------------- Mission rules ------------------------------ */

export type RuleLevel = { level: 'caution' | 'action'; dir: 'high' | 'low'; bound: number };

/** Mission-rule level of a value (BP uses systolic). Null when within limits or no rule exists. */
export function ruleLevel(type: VitalType, value: number, rules: MissionRules): RuleLevel | null {
  const r = rules.vitals[type];
  if (!r) return null;
  if (r.actionHigh !== undefined && value >= r.actionHigh) return { level: 'action', dir: 'high', bound: r.actionHigh };
  if (r.actionLow !== undefined && value <= r.actionLow) return { level: 'action', dir: 'low', bound: r.actionLow };
  if (r.cautionHigh !== undefined && value >= r.cautionHigh) return { level: 'caution', dir: 'high', bound: r.cautionHigh };
  if (r.cautionLow !== undefined && value <= r.cautionLow) return { level: 'caution', dir: 'low', bound: r.cautionLow };
  return null;
}

/** Approved protocol most relevant to an out-of-limits vital (decision support only). */
export const VITAL_PROTOCOL: Partial<Record<VitalType, string>> = {
  spo2: 'AEG-EM-002',
  heart_rate: 'AEG-EM-001',
  respiratory_rate: 'AEG-EM-002',
  temperature: 'AEG-MD-002',
  blood_pressure: 'AEG-EM-001',
  hrv: 'AEG-BH-001',
};

/** Vitals whose action-level values warrant the emergency screen. */
export const EMERGENCY_VITALS: VitalType[] = ['spo2', 'heart_rate'];

/* -------------------------------- Findings -------------------------------- */

/** Engine findings that concern a metric (rule, anomaly, quality and pattern contributions). */
export function findingsFor(findings: Insight[], type: VitalType): Insight[] {
  return findings.filter((f) => f.id.split(':').includes(type) || f.contributing.some((c) => c.measurementType === type));
}

export const staleFinding = (findings: Insight[], type: VitalType) => findings.find((f) => f.id === `quality:stale:${type}`);

/* ---------------------------------- Gaps ---------------------------------- */

/** Largest gap between consecutive readings in the last `days` days (hours), including the gap up to now. */
export function largestGapH(ms: Measurement[], type: VitalType, now: number, days = 7): number | null {
  const s = seriesOf(ms, type, now)
    .map((m) => new Date(m.takenAt).getTime())
    .filter((t) => t > now - days * DAY && t <= now);
  if (!s.length) return null;
  let gap = now - s[s.length - 1];
  for (let i = 1; i < s.length; i++) gap = Math.max(gap, s[i] - s[i - 1]);
  return gap / 3_600_000;
}

/* --------------------------------- Trends --------------------------------- */

export type TrendSeries = { key: string; label: string; points: { t: number; v: number }[]; style: 'accent' | 'muted' | 'ink' | 'heat' };

/**
 * In-flight readings as the primary series and pre-flight readings as a muted
 * comparison, so the launch boundary is visible on the chart.
 */
export function splitByLaunch(ms: Measurement[], type: VitalType, launchedAt: string, from: number, to: number, units: UnitPrefs, pick: (m: Measurement) => number = (m) => m.value) {
  const launch = new Date(launchedAt).getTime();
  const inRange = ms.filter((m) => {
    const ts = new Date(m.takenAt).getTime();
    return m.type === type && !m.qualityFlag && ts >= from && ts <= to;
  });
  const pt = (m: Measurement) => ({ t: new Date(m.takenAt).getTime(), v: type === 'blood_pressure' ? pick(m) : toDisplay(type, pick(m), units) });
  const sorted = [...inRange].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  return {
    flight: sorted.filter((m) => new Date(m.takenAt).getTime() >= launch).map(pt),
    preflight: sorted.filter((m) => new Date(m.takenAt).getTime() < launch).map(pt),
    count: sorted.length,
    spansLaunch: launch > from && launch <= to,
  };
}

/** Baseline band in display units (BP: systolic), or undefined when not established enough to draw. */
export function baselineBand(b: Baseline | undefined, type: VitalType, units: UnitPrefs): [number, number] | undefined {
  if (!b || b.quality === 'insufficient' || !Number.isFinite(b.p10) || !Number.isFinite(b.p90)) return undefined;
  return [toDisplay(type, b.p10, units), toDisplay(type, b.p90, units)];
}

/* --------------------------------- Format --------------------------------- */

/** Mission Elapsed Time, e.g. "D+062 14:22:09" (or "L-003 …" before launch). */
export function formatMet(launchedAt: string, now: number): string {
  const diff = now - new Date(launchedAt).getTime();
  const abs = Math.abs(diff);
  const days = Math.floor(abs / DAY);
  const rem = abs - days * DAY;
  const p = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(rem / 3_600_000);
  const m = Math.floor((rem % 3_600_000) / MIN);
  const s = Math.floor((rem % MIN) / 1000);
  return `${diff >= 0 ? 'D+' : 'L-'}${String(days).padStart(3, '0')} ${p(h)}:${p(m)}:${p(s)}`;
}

/** One-way communication delay, e.g. "0.6 s" or "11 min 00 s". */
export function formatDelay(sec: number): string {
  if (sec < 60) return `${sec < 10 ? sec.toFixed(1) : Math.round(sec)} s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec - m * 60);
  return `${m} min ${String(s).padStart(2, '0')} s`;
}

/** Compact telemetry timestamp, e.g. "13 NOV 14:22". */
export function stamp(iso: string): string {
  const d = new Date(iso);
  const mon = d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())} ${mon} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** "4 min ago" style age, computed from a render-stable `now`. */
export function ago(iso: string, now: number): string {
  const min = Math.round((now - new Date(iso).getTime()) / MIN);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

/** "in 1 h 40 min" style countdown to a future time. */
export function until(iso: string, now: number): string {
  const min = Math.max(0, Math.round((new Date(iso).getTime() - now) / MIN));
  if (min < 1) return 'now';
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  return `in ${h} h ${String(min - h * 60).padStart(2, '0')} min`;
}
