/* Copied verbatim from the CosmicPulse mobile app (src/features/intelligence/intel.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { AlertState, HealthAlert, Measurement, Protocol, Severity, VitalType } from '@/data/types';
import { VITAL_META } from '@/data/vitals';
import type { Baseline, BaselineQuality, RiskAssessment, RiskLevel } from '@/engine';
import type { Tone } from '@/theme';

/**
 * Pure helpers for the Intelligence area. No React here so they can be tested
 * and reused by the tab, detail pages and the assistant.
 */

const DAY = 86_400_000;

/* ------------------------------- Route params ------------------------------ */

/** Finding ids contain ':' (e.g. `anomaly:hrv:low`) and may arrive percent-encoded once or twice. */
export function decodeParam(raw: string | string[] | undefined): string {
  let v = Array.isArray(raw) ? raw.join('/') : (raw ?? '');
  for (let i = 0; i < 2 && /%[0-9A-Fa-f]{2}/.test(v); i += 1) {
    try {
      v = decodeURIComponent(v);
    } catch {
      break;
    }
  }
  return v;
}

/* ---------------------------------- Copy ----------------------------------- */

export const RISK_COPY: Record<RiskLevel, { label: string; tone: Tone }> = {
  nominal: { label: 'Nominal', tone: 'success' },
  monitor: { label: 'Monitor', tone: 'info' },
  elevated: { label: 'Elevated', tone: 'warning' },
  high: { label: 'High', tone: 'critical' },
  critical: { label: 'Critical', tone: 'critical' },
};

export const RISK_ORDER: RiskLevel[] = ['nominal', 'monitor', 'elevated', 'high', 'critical'];

export const ESCALATION_LABEL: Record<RiskAssessment['escalation'], string> = {
  none: 'No escalation',
  self_monitor: 'Self-monitor',
  crew_medical_officer: 'Crew medical officer',
  flight_surgeon: 'Flight surgeon',
  emergency: 'Emergency',
};

export const ALERT_STATE_COPY: Record<AlertState, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'warning' },
  acknowledged: { label: 'Acknowledged', tone: 'info' },
  escalated: { label: 'Escalated', tone: 'critical' },
  resolved: { label: 'Resolved', tone: 'success' },
};

export const QUALITY_COPY: Record<BaselineQuality, { label: string; tone: Tone; detail: string }> = {
  established: { label: 'Established', tone: 'success', detail: '≥ 20 readings over ≥ 10 days' },
  provisional: { label: 'Provisional', tone: 'warning', detail: '10–19 readings or 5–9 days — comparisons are less certain' },
  insufficient: { label: 'Insufficient', tone: 'neutral', detail: 'Fewer than 10 readings or 5 days — not used for analysis' },
};

export const PROTOCOL_CATEGORY_LABEL: Record<Protocol['category'], string> = {
  emergency: 'Emergency',
  medical: 'Medical',
  environmental: 'Environmental',
  behavioral: 'Behavioural',
  equipment: 'Equipment',
  training: 'Training',
};

export const SEVERITY_TO_RISK: Record<Severity, RiskLevel> = { info: 'nominal', low: 'monitor', moderate: 'elevated', high: 'high', critical: 'critical' };

export const fmtMetric = (t: VitalType, v: number) => (Number.isFinite(v) ? v.toFixed(VITAL_META[t].decimals) : '—');

/* --------------------------- Linear-trend projection ------------------------ */

export type Projection = {
  metric: VitalType;
  n: number;
  spanDays: number;
  /** Units per day. */
  slope: number;
  /** Fitted value now and projected at `horizonDays`. */
  fittedNow: number;
  projected: number;
  horizonDays: number;
  r2: number;
  /** Days until the projection leaves the usual range, if it does within the horizon. */
  leavesRangeInDays?: number;
  direction: 'rising' | 'falling';
  outside: 'above' | 'below' | null;
  baseline: Baseline;
};

/**
 * Honest trend projection: ordinary least squares on the last `windowDays` of
 * readings, extrapolated `horizonDays` ahead and compared with the personal
 * usual range. Returns null unless the slope is statistically meaningful
 * (|t| ≥ 3), the fit explains a real share of the variance (R² ≥ 0.3) and the
 * projected change is larger than the baseline's own spread.
 */
export function projectTrend(
  all: Measurement[],
  metric: VitalType,
  baseline: Baseline | undefined,
  now: number,
  { windowDays = 14, horizonDays = 7 }: { windowDays?: number; horizonDays?: number } = {},
): Projection | null {
  if (!baseline || baseline.quality === 'insufficient') return null;
  const pts = all
    .filter((m) => m.type === metric && !m.qualityFlag)
    .map((m) => ({ x: (new Date(m.takenAt).getTime() - now) / DAY, y: m.value }))
    .filter((p) => p.x <= 0 && p.x >= -windowDays);
  const n = pts.length;
  if (n < 6) return null;
  const spanDays = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
  if (spanDays < 5) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  const sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  const sxy = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const syy = pts.reduce((a, p) => a + (p.y - my) ** 2, 0);
  if (sxx === 0 || syy === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const ssr = pts.reduce((a, p) => a + (p.y - (intercept + slope * p.x)) ** 2, 0);
  const r2 = 1 - ssr / syy;
  const se = Math.sqrt(ssr / Math.max(1, n - 2) / sxx);
  const tStat = se === 0 ? Infinity : Math.abs(slope / se);
  const projected = intercept + slope * horizonDays;
  if (tStat < 3 || r2 < 0.3 || Math.abs(slope * horizonDays) < baseline.spread) return null;

  const lo = baseline.p10;
  const hi = baseline.p90;
  const outside = projected > hi ? 'above' : projected < lo ? 'below' : null;
  let leavesRangeInDays: number | undefined;
  if (outside) {
    const bound = outside === 'above' ? hi : lo;
    const d = (bound - intercept) / slope;
    leavesRangeInDays = d <= 0 ? 0 : Math.ceil(d);
  }
  return {
    metric,
    n,
    spanDays,
    slope,
    fittedNow: intercept,
    projected,
    horizonDays,
    r2,
    leavesRangeInDays,
    direction: slope > 0 ? 'rising' : 'falling',
    outside,
    baseline,
  };
}

/* ------------------------------- Risk history ------------------------------- */

export type RiskDay = { day: string; level: RiskLevel; alerts: string[] };

/** When an alert was resolved (last transition to resolved), or undefined if still open. */
export function resolvedAt(a: HealthAlert): string | undefined {
  if (a.state !== 'resolved') return undefined;
  const r = [...a.history].reverse().find((h) => h.state === 'resolved');
  return r?.at ?? a.updatedAt;
}

/**
 * Daily risk level reconstructed from alert histories: for each of the last
 * `days` days, the highest severity among alerts that were open at any point
 * that day. Same severity → level mapping as the risk engine.
 */
export function riskHistory(alerts: HealthAlert[], now: number, days = 14): RiskDay[] {
  const out: RiskDay[] = [];
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const from = startToday.getTime() - i * DAY;
    const to = from + DAY;
    let level: RiskLevel = 'nominal';
    const titles: string[] = [];
    for (const a of alerts) {
      const opened = new Date(a.createdAt).getTime();
      const closedIso = resolvedAt(a);
      const closed = closedIso ? new Date(closedIso).getTime() : Infinity;
      if (opened < to && closed >= from) {
        const l = SEVERITY_TO_RISK[a.severity];
        if (RISK_ORDER.indexOf(l) > RISK_ORDER.indexOf(level)) level = l;
        titles.push(a.title);
      }
    }
    out.push({ day: new Date(from).toISOString(), level, alerts: titles });
  }
  return out;
}

export type HistoryEvent = { key: string; at: string; alertId: string; title: string; severity: Severity; state: AlertState; by: string; note?: string; insightId: string };

/** Flattened, newest-first event log across all alerts. */
export function alertEvents(alerts: HealthAlert[], limit = 50): HistoryEvent[] {
  return alerts
    .flatMap((a) => a.history.map((h, i) => ({ key: `${a.id}-${i}`, at: h.at, alertId: a.id, title: a.title, severity: a.severity, state: h.state, by: h.by, note: h.note, insightId: a.insightId })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

/** Latest alert for a finding id (fingerprint), newest first. */
export function alertForFinding(alerts: HealthAlert[], findingId: string): HealthAlert | undefined {
  return alerts.filter((a) => a.fingerprint === findingId || a.insightId === findingId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}
