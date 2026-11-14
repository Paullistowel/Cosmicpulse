/* Copied verbatim from the CosmicPulse mobile app (src/data/demo/conditions.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { Measurement, SleepRecord } from '@/data/types';

/**
 * Simulated health conditions for demonstrating the detection → alert →
 * explanation workflow. Each one deterministically reshapes the last few days
 * of the SIMULATED demo readings only (never real ones) and tags every changed
 * reading with a note, so it is visibly simulated wherever it appears.
 *
 * The detection engine is NOT told about these conditions — it finds them on
 * its own, exactly as it would with real data.
 */
export type DemoConditionId = 'none' | 'mild_deviation' | 'rhr_trend' | 'sleep_change' | 'low_spo2' | 'persistent_multi' | 'urgent';

export const DEMO_CONDITIONS: { id: DemoConditionId; title: string; description: string; expected: string }[] = [
  { id: 'none', title: 'Normal readings', description: 'Stable vitals around the personal baseline.', expected: 'No alerts' },
  { id: 'mild_deviation', title: 'Mild heart-rate deviation', description: 'Heart rate ~10 bpm above baseline for 2 days.', expected: 'Informational' },
  { id: 'rhr_trend', title: 'Rising resting heart rate', description: 'Heart rate rises ~6–10 bpm above baseline and stays there for 5 days.', expected: 'Attention recommended' },
  { id: 'sleep_change', title: 'Sleep pattern change', description: 'Five short nights (~5 h) after a stable 7 h pattern.', expected: 'Attention recommended' },
  { id: 'low_spo2', title: 'Low oxygen readings', description: 'SpO₂ drops to 92% then 89% (one reading at action level).', expected: 'Medical review recommended' },
  { id: 'persistent_multi', title: 'Persistent multi-signal change', description: 'Resting HR up, HRV down, temperature and breathing rate up for 4 days.', expected: 'Medical review recommended' },
  { id: 'urgent', title: 'Urgent warning signs', description: 'Two SpO₂ readings at 88% and 86% with heart rate 124 bpm.', expected: 'Urgent attention' },
];

const DAY = 86_400_000;
const daysAgo = (iso: string, now: number) => Math.floor((now - new Date(iso).getTime()) / DAY);
const tag = (id: DemoConditionId) => `SIMULATED condition: ${DEMO_CONDITIONS.find((c) => c.id === id)?.title}`;

/** Returns the pool readings with the chosen condition applied (pure; real readings never pass through here). */
export function applyCondition(measurements: Measurement[], sleep: SleepRecord[], id: DemoConditionId, now: number): { measurements: Measurement[]; sleepRecords: SleepRecord[] } {
  if (id === 'none') return { measurements, sleepRecords: sleep };
  const note = tag(id);
  // Latest pool reading per type (to place point events on the most recent readings).
  const latest = new Map<string, string[]>();
  // Only readings already taken (the generator also schedules later-today slots).
  for (const m of [...measurements].filter((x) => new Date(x.takenAt).getTime() <= now).sort((a, b) => b.takenAt.localeCompare(a.takenAt))) {
    const arr = latest.get(m.type) ?? [];
    if (arr.length < 2) arr.push(m.id);
    latest.set(m.type, arr);
  }
  const isLatest = (m: Measurement, n = 1) => (latest.get(m.type) ?? []).slice(0, n).includes(m.id);
  const morning = (m: Measurement) => new Date(m.takenAt).getHours() <= 7;

  const out = measurements.map((m) => {
    const d = daysAgo(m.takenAt, now);
    const ramp = (days: number) => (d < days ? (days - d) / days : 0);
    let v = m.value;
    switch (id) {
      case 'mild_deviation':
        // Two days only: unusual but not yet persistent.
        if (m.type === 'heart_rate' && d < 2) v = m.value + 10;
        break;
      case 'rhr_trend':
        if (m.type === 'heart_rate' && d < 5) v = m.value + Math.round(5 + 5 * ramp(5) + (morning(m) ? 2 : 0));
        break;
      case 'sleep_change':
        if (m.type === 'sleep' && d < 5) v = Math.round((4.9 + ((d * 37) % 7) / 10) * 10) / 10;
        break;
      case 'low_spo2':
        if (m.type === 'spo2' && isLatest(m, 2)) v = isLatest(m, 1) ? 89 : 92;
        break;
      case 'persistent_multi':
        if (d < 4) {
          const r = ramp(4) * 0.6 + 0.4;
          if (m.type === 'heart_rate') v = m.value + Math.round(13 * r);
          if (m.type === 'hrv') v = Math.max(15, m.value - Math.round(20 * r));
          if (m.type === 'temperature') v = Math.round((m.value + 0.9 * r) * 10) / 10;
          if (m.type === 'respiratory_rate') v = m.value + Math.round(4 * r);
        }
        break;
      case 'urgent':
        if (m.type === 'spo2' && isLatest(m, 2)) v = isLatest(m, 1) ? 86 : 88;
        if (m.type === 'heart_rate' && isLatest(m, 2)) v = 124;
        break;
    }
    return v === m.value ? m : { ...m, value: v, note };
  });

  const sleepRecords =
    id === 'sleep_change'
      ? sleep.map((r) => {
          const d = daysAgo(r.night, now);
          return d < 5 ? { ...r, hours: Math.round((4.9 + ((d * 37) % 7) / 10) * 10) / 10, quality: 45, disruptions: 4 } : r;
        })
      : sleep;
  return { measurements: out, sleepRecords };
}
