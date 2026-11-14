import type { Measurement, VitalType } from '@/data/types';
import { toDisplay, type UnitPrefs } from '@/data/vitals';
import { sourceLabel } from '@/lib/format';
import type { TrendPoint } from '@/components/viz';

export type RangeKey = '24h' | '7d' | '30d' | '90d' | 'all';
export const RANGE_MS: Record<RangeKey, number> = { '24h': 86_400_000, '7d': 7 * 86_400_000, '30d': 30 * 86_400_000, '90d': 90 * 86_400_000, all: Number.POSITIVE_INFINITY };
export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: '24h', label: '24 h' },
  { value: '7d', label: '7 d' },
  { value: '30d', label: '30 d' },
  { value: '90d', label: '90 d' },
  { value: 'all', label: 'All' },
];

export const isSynthetic = (m: Pick<Measurement, 'source'>) => m.source.kind === 'simulated' || m.source.kind === 'demo';

/** Chart points for one metric in a time range, in display units, oldest first. */
export function trendPoints(ms: Measurement[], type: VitalType, range: RangeKey, now: number, units: UnitPrefs): TrendPoint[] {
  const from = now - RANGE_MS[range];
  return ms
    .filter((m) => m.type === type && new Date(m.takenAt).getTime() >= from && new Date(m.takenAt).getTime() <= now + 60_000)
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
    .map((m) => ({
      t: new Date(m.takenAt).getTime(),
      v: toDisplay(type, m.value, units),
      v2: m.value2 !== undefined ? m.value2 : undefined,
      synthetic: isSynthetic(m),
      source: sourceLabel(m.source),
      flagged: !!m.qualityFlag,
    }));
}

/** Daily mean of a metric (for multi-day overviews). */
export function dailyMeans(ms: Measurement[], type: VitalType, days: number, now: number): { day: string; t: number; v: number; n: number; synthetic: boolean }[] {
  const out = new Map<string, { sum: number; n: number; syn: number; t: number }>();
  for (const m of ms) {
    if (m.type !== type || m.qualityFlag) continue;
    const t = new Date(m.takenAt).getTime();
    if (t < now - days * 86_400_000 || t > now) continue;
    const day = m.takenAt.slice(0, 10);
    const e = out.get(day) ?? { sum: 0, n: 0, syn: 0, t: new Date(day).getTime() };
    e.sum += m.value;
    e.n++;
    if (isSynthetic(m)) e.syn++;
    out.set(day, e);
  }
  return [...out.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, e]) => ({ day, t: e.t, v: e.sum / e.n, n: e.n, synthetic: e.syn === e.n }));
}
