/* Copied verbatim from the CosmicPulse mobile app (src/engine/analysis.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { EnvironmentReading, Insight, Measurement, SleepRecord, Severity, VitalType } from '@/data/types';
import { VITAL_META } from '@/data/vitals';
import { BASELINE_SOURCE_COPY, median, type Baseline } from './baseline';
import type { MissionRules } from './mission-rules';

/**
 * CosmicPulse Health Analysis Engine.
 *
 * Pure functions: same inputs → same findings. Everything runs on device so
 * analysis continues during loss of signal. Each finding states its method,
 * the data it used and its uncertainty, and is classified as:
 *  - statistical_anomaly  → "Anomaly": differs from this astronaut's baseline;
 *  - screening_indicator  → "Potential risk": breaches a mission rule or
 *                           matches a multi-signal rule;
 *  - confirmed_diagnosis  → only ever entered by a clinician.
 */

export const ENGINE_VERSION = 'cosmicpulse-engine 1.0.0 (rule-based; no trained model)';
const DAY = 86_400_000;
const H = 3_600_000;

type Ctx = { measurements: Measurement[]; baselines: Partial<Record<VitalType, Baseline>>; rules: MissionRules; now: number };

/** Direction in which a deviation matters clinically for each metric. */
const CONCERN: Partial<Record<VitalType, 'high' | 'low' | 'both'>> = {
  heart_rate: 'both',
  hrv: 'low',
  spo2: 'low',
  respiratory_rate: 'high',
  temperature: 'high',
  blood_pressure: 'both',
  weight: 'both',
  sleep: 'low',
};

/** Minimum absolute shift before a statistically unusual change is worth surfacing. */
const MIN_SHIFT: Partial<Record<VitalType, number>> = {
  heart_rate: 6,
  hrv: 8,
  spo2: 1.5,
  respiratory_rate: 3,
  temperature: 0.4,
  blood_pressure: 10,
  weight: 1.5,
  sleep: 1,
};

const PROTOCOLS_FOR: Partial<Record<VitalType, string[]>> = {
  spo2: ['AEG-EM-002'],
  temperature: ['AEG-MD-002'],
  heart_rate: ['AEG-EM-003'],
  sleep: ['AEG-BH-001'],
  hrv: ['AEG-BH-001'],
};

const fmt = (t: VitalType, v: number) => v.toFixed(VITAL_META[t].decimals);

export function recentOf(ms: Measurement[], type: VitalType, now: number, days = 3) {
  return ms
    .filter((m) => m.type === type && !m.qualityFlag)
    .filter((m) => {
      const t = new Date(m.takenAt).getTime();
      return t > now - days * DAY && t <= now;
    })
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}

/** Robust z-score of the recent median against the personal baseline. */
export function deviation(ctx: Ctx, type: VitalType, days = 3) {
  const b = ctx.baselines[type];
  const recent = recentOf(ctx.measurements, type, ctx.now, days);
  if (!b || b.quality === 'insufficient' || recent.length < 2) return null;
  const r = median(recent.map((m) => m.value));
  return { baseline: b, recent, recentMedian: r, z: (r - b.median) / b.spread, shift: r - b.median };
}

/**
 * Consecutive most-recent days whose daily median sits outside the personal
 * usual range (10th–90th percentile) in the given direction. Distinguishes an
 * isolated reading (0–1 days) from a persistent change (≥ 3 days).
 */
export function persistentDays(ctx: Ctx, type: VitalType, dir: 'high' | 'low', maxDays = 7): number {
  const b = ctx.baselines[type];
  if (!b || b.quality === 'insufficient') return 0;
  let n = 0;
  for (let d = 0; d < maxDays; d++) {
    const day = ctx.measurements.filter((m) => m.type === type && !m.qualityFlag && ctx.now - new Date(m.takenAt).getTime() >= d * DAY && ctx.now - new Date(m.takenAt).getTime() < (d + 1) * DAY);
    if (!day.length) break;
    const med = median(day.map((m) => m.value));
    if (dir === 'high' ? med > b.p90 : med < b.p10) n++;
    else break;
  }
  return n;
}

const UPGRADE: Partial<Record<Severity, Severity>> = { low: 'moderate', moderate: 'high' };

/* ------------------------------ Baseline anomalies ------------------------------ */

export function baselineAnomalies(ctx: Ctx): Insight[] {
  const out: Insight[] = [];
  for (const type of Object.keys(CONCERN) as VitalType[]) {
    const d = deviation(ctx, type);
    if (!d) continue;
    const concern = CONCERN[type]!;
    const dir = d.z > 0 ? 'high' : 'low';
    if (concern !== 'both' && concern !== dir) continue;
    if (Math.abs(d.z) < 2.5 || Math.abs(d.shift) < (MIN_SHIFT[type] ?? 0)) continue;
    const meta = VITAL_META[type];
    const days = persistentDays(ctx, type, dir);
    const base: Severity = Math.abs(d.z) >= 4 ? 'moderate' : 'low';
    // A change that persists for 3+ consecutive days is one step more serious than an isolated one.
    const sev: Severity = days >= 3 ? (UPGRADE[base] ?? base) : base;
    out.push({
      id: `anomaly:${type}:${dir}`,
      kind: 'statistical_anomaly',
      module: type === 'sleep' ? 'recovery' : 'vitals',
      title: `${meta.label} ${dir === 'high' ? 'above' : 'below'} your baseline`,
      summary: `Recent median ${fmt(type, d.recentMedian)} ${meta.unit} vs your baseline ${fmt(type, d.baseline.median)} ${meta.unit}.`,
      severity: sev,
      detectedAt: new Date(ctx.now).toISOString(),
      whatChanged: `Shifted ${d.shift > 0 ? '+' : ''}${fmt(type, d.shift)} ${meta.unit} over the last 3 days (${d.recent.length} readings). ${days >= 3 ? `Persistent: outside your usual range for ${days} consecutive days.` : days >= 1 ? 'Recent: outside your usual range today but not yet persistent.' : 'The daily values have not stayed outside your usual range.'}`,
      why: `The 3-day median is ${Math.abs(d.z).toFixed(1)} robust standard deviations from your personal baseline (threshold 2.5) and exceeds the minimum meaningful change of ${MIN_SHIFT[type]} ${meta.unit}. ${BASELINE_SOURCE_COPY[d.baseline.source]}.`,
      contributing: [
        { label: 'Baseline (median)', value: `${fmt(type, d.baseline.median)} ${meta.unit}` },
        { label: 'Usual range (10th–90th pct)', value: `${fmt(type, d.baseline.p10)}–${fmt(type, d.baseline.p90)} ${meta.unit}` },
        { label: 'Recent median', value: `${fmt(type, d.recentMedian)} ${meta.unit}`, measurementType: type },
        { label: 'Baseline quality', value: `${d.baseline.quality} · ${d.baseline.n} readings over ${d.baseline.coverageDays} days` },
      ],
      uncertainty:
        d.baseline.quality === 'provisional'
          ? 'Your baseline is still provisional (limited data), so this comparison is less certain. Workload, exercise timing, sensor placement and mission schedule changes can all shift readings.'
          : 'Workload, exercise timing, sensor placement and mission schedule changes can all shift readings. This is a pattern in your data, not a diagnosis.',
      nextStep: 'Keep measuring at the usual times. Mention it to the crew medical officer if it persists or you feel unwell.',
      status: 'new',
      method: `${ENGINE_VERSION} · personal-baseline robust z-score`,
      protocolIds: PROTOCOLS_FOR[type],
    });
  }
  return out;
}

/* -------------------------------- Mission rules -------------------------------- */

export function ruleBreaches(ctx: Ctx): Insight[] {
  const out: Insight[] = [];
  for (const [type, r] of Object.entries(ctx.rules.vitals) as [VitalType, NonNullable<MissionRules['vitals'][VitalType]>][]) {
    const recent = recentOf(ctx.measurements, type, ctx.now, 1);
    const last = recent[recent.length - 1];
    if (!last) continue;
    const v = last.value;
    const meta = VITAL_META[type];
    let level: 'caution' | 'action' | null = null;
    let bound = 0;
    let dir: 'high' | 'low' = 'high';
    if (r.actionHigh !== undefined && v >= r.actionHigh) [level, bound, dir] = ['action', r.actionHigh, 'high'];
    else if (r.actionLow !== undefined && v <= r.actionLow) [level, bound, dir] = ['action', r.actionLow, 'low'];
    else if (r.cautionHigh !== undefined && v >= r.cautionHigh) [level, bound, dir] = ['caution', r.cautionHigh, 'high'];
    else if (r.cautionLow !== undefined && v <= r.cautionLow) [level, bound, dir] = ['caution', r.cautionLow, 'low'];
    if (!level) continue;
    // A single reading at action level is "high"; confirmed by a second reading it becomes critical.
    const confirming = recent.filter((m) => (dir === 'high' ? m.value >= bound : m.value <= bound)).length;
    const severity: Severity = level === 'action' ? (confirming >= 2 ? 'critical' : 'high') : 'moderate';
    out.push({
      id: `rule:${type}:${dir}`,
      kind: 'screening_indicator',
      module: 'vitals',
      title: `${meta.label} ${level === 'action' ? 'at action level' : 'at caution level'}`,
      summary: `Latest ${fmt(type, v)} ${meta.unit} (${dir === 'high' ? '≥' : '≤'} ${bound} ${meta.unit} ${level} level).`,
      severity,
      detectedAt: last.takenAt,
      whatChanged: `${confirming} reading${confirming === 1 ? '' : 's'} in the last 24 h ${dir === 'high' ? 'at or above' : 'at or below'} ${bound} ${meta.unit}.`,
      why: `Mission rule ${ctx.rules.version}: ${meta.label.toLowerCase()} ${level} level ${dir === 'high' ? '≥' : '≤'} ${bound} ${meta.unit}.${confirming < 2 && level === 'action' ? ' Not yet confirmed by a second reading.' : ''}`,
      contributing: recent.slice(-4).map((m) => ({ label: new Date(m.takenAt).toLocaleString(), value: `${fmt(type, m.value)} ${meta.unit}`, measurementType: type })),
      uncertainty: 'A single sensor reading can be wrong. Repeat the measurement with a second instrument before acting.',
      nextStep: level === 'action' ? 'Repeat the measurement now and follow the linked protocol. Notify the crew medical officer.' : 'Repeat the measurement and keep monitoring.',
      status: 'new',
      method: `Mission rules ${ctx.rules.version} (demo values)`,
      protocolIds: PROTOCOLS_FOR[type],
    });
  }
  return out;
}

/* --------------------------------- Data quality -------------------------------- */

export function dataQuality(ctx: Ctx): Insight[] {
  const out: Insight[] = [];
  for (const [type, hours] of Object.entries(ctx.rules.expectedIntervalH) as [VitalType, number][]) {
    const series = ctx.measurements.filter((m) => m.type === type).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
    const last = series[series.length - 1];
    if (!last) continue;
    const age = ctx.now - new Date(last.takenAt).getTime();
    if (age > hours * 3 * H && age < 30 * DAY) {
      out.push({
        id: `quality:stale:${type}`,
        kind: 'statistical_anomaly',
        module: 'data_quality',
        title: `${VITAL_META[type].label} data is stale`,
        summary: `No reading for ${Math.round(age / H)} h (expected every ${hours} h).`,
        severity: 'low',
        detectedAt: new Date(ctx.now).toISOString(),
        whatChanged: `Last reading ${new Date(last.takenAt).toLocaleString()}${'deviceName' in last.source ? ` from ${last.source.deviceName}` : ''}.`,
        why: `Readings are expected every ${hours} h; the gap is more than three intervals.`,
        contributing: [{ label: 'Last reading', value: `${fmt(type, last.value)} ${VITAL_META[type].unit}`, measurementType: type }],
        uncertainty: 'This is a data-coverage issue, not a health finding. Analysis of this metric is paused until data resumes.',
        nextStep: 'Check the sensor battery and placement, or take a manual reading.',
        status: 'new',
        method: `${ENGINE_VERSION} · stale-sensor rule`,
        protocolIds: ['AEG-EQ-001'],
      });
    }
  }
  for (const m of ctx.measurements.filter((x) => x.qualityFlag && ctx.now - new Date(x.takenAt).getTime() < 7 * DAY)) {
    out.push({
      id: `quality:reading:${m.id}`,
      kind: 'statistical_anomaly',
      module: 'data_quality',
      title: `Check this ${VITAL_META[m.type].label.toLowerCase()} reading`,
      summary: m.qualityFlag!,
      severity: 'info',
      detectedAt: m.takenAt,
      whatChanged: `${fmt(m.type, m.value)} ${m.unit} recorded.`,
      why: 'The value is implausible for its context or inconsistent with neighbouring readings, so it is excluded from baselines and analysis.',
      contributing: [{ label: 'Reading', value: `${fmt(m.type, m.value)} ${m.unit}`, measurementType: m.type }],
      uncertainty: 'Data-quality check only.',
      nextStep: 'Repeat the measurement or delete the reading if it is wrong.',
      status: 'new',
      method: `${ENGINE_VERSION} · plausibility rule`,
      protocolIds: ['AEG-EQ-001'],
    });
  }
  return out;
}

/* --------------------------------- Multi-signal -------------------------------- */

/**
 * Physiological strain pattern: elevated resting HR, suppressed HRV and a
 * rising temperature or respiratory rate together. Any two of the three
 * signals must deviate from baseline in the concerning direction.
 */
export function patterns(ctx: Ctx): Insight[] {
  const hr = deviation(ctx, 'heart_rate');
  const hrv = deviation(ctx, 'hrv');
  const temp = deviation(ctx, 'temperature');
  const rr = deviation(ctx, 'respiratory_rate');
  const signals = [
    hr && hr.z >= 1.5 ? { label: 'Resting heart rate', d: hr, t: 'heart_rate' as const } : null,
    hrv && hrv.z <= -1.5 ? { label: 'HRV', d: hrv, t: 'hrv' as const } : null,
    temp && temp.z >= 1.5 ? { label: 'Temperature', d: temp, t: 'temperature' as const } : null,
    rr && rr.z >= 1.5 ? { label: 'Respiratory rate', d: rr, t: 'respiratory_rate' as const } : null,
  ].filter(Boolean) as { label: string; d: NonNullable<ReturnType<typeof deviation>>; t: VitalType }[];
  if (signals.length < 2 || !signals.some((s) => s.t === 'heart_rate' || s.t === 'hrv')) return [];
  const persistent = Math.max(persistentDays(ctx, 'heart_rate', 'high'), persistentDays(ctx, 'hrv', 'low'));
  // Three or more signals together for 3+ days → medical review recommended.
  const sev: Severity = signals.length >= 3 ? (persistent >= 3 ? 'high' : 'moderate') : 'low';
  return [
    {
      id: 'pattern:physiological-strain',
      kind: 'screening_indicator',
      module: 'pattern',
      title: 'Physiological strain pattern',
      summary: `${signals.map((s) => s.label).join(', ')} are moving away from your baseline together.`,
      severity: sev,
      detectedAt: new Date(ctx.now).toISOString(),
      whatChanged: signals.map((s) => `${s.label} ${s.d.shift > 0 ? '+' : ''}${fmt(s.t, s.d.shift)} ${VITAL_META[s.t].unit}`).join('; ') + `.${persistent >= 3 ? ` Persisting for ${persistent} consecutive days.` : ''}`,
      why: 'Rule: at least two of resting HR ↑, HRV ↓, temperature ↑, respiratory rate ↑ deviate ≥ 1.5 robust SD from baseline at the same time. This combination can accompany fatigue, dehydration or early illness.',
      contributing: signals.map((s) => ({ label: s.label, value: `z = ${s.d.z.toFixed(1)}`, measurementType: s.t })),
      uncertainty: 'Pattern rules are sensitive but not specific — heavy exercise, poor sleep or workload can produce the same picture.',
      nextStep: 'Rest, hydrate and re-check in 12 hours. Report symptoms to the crew medical officer.',
      status: 'new',
      method: `${ENGINE_VERSION} · multi-signal rule`,
      protocolIds: ['AEG-MD-002', 'AEG-BH-001'],
    },
  ];
}

/* --------------------------------- Recovery -------------------------------- */

export function recovery(sleep: SleepRecord[], now: number, targetH = 7): Insight[] {
  const last5 = sleep.filter((s) => now - new Date(s.night).getTime() < 5 * DAY).sort((a, b) => a.night.localeCompare(b.night));
  const short = last5.filter((s) => s.hours < targetH - 1);
  if (last5.length < 3 || short.length < 3) return [];
  return [
    {
      id: 'recovery:sleep-debt',
      kind: 'screening_indicator',
      module: 'recovery',
      title: 'Accumulating sleep debt',
      summary: `${short.length} of the last ${last5.length} sleep periods were under ${targetH - 1} h.`,
      // Four or more short nights out of five is a persistent change → attention recommended.
      severity: short.length >= 4 ? 'moderate' : 'low',
      detectedAt: new Date(now).toISOString(),
      whatChanged: `Average ${(last5.reduce((a, s) => a + s.hours, 0) / last5.length).toFixed(1)} h over ${last5.length} nights.`,
      why: `Rule: three or more of the last five sleep periods below ${targetH - 1} h (crew target ${targetH} h).`,
      contributing: last5.map((s) => ({ label: new Date(s.night).toLocaleDateString(), value: `${s.hours.toFixed(1)} h · quality ${s.quality}`, measurementType: 'sleep' as const })),
      uncertainty: 'Wearable sleep estimates are approximate.',
      nextStep: 'Protect the next sleep window and review noise, light and CO₂ in the sleep station.',
      status: 'new',
      method: `${ENGINE_VERSION} · sleep-debt rule`,
      protocolIds: ['AEG-BH-001'],
    },
  ];
}

/* -------------------------------- Environment -------------------------------- */

export function environment(readings: EnvironmentReading[], rules: MissionRules, now: number): Insight[] {
  const out: Insight[] = [];
  const latest = new Map<string, EnvironmentReading>();
  for (const r of readings) {
    const cur = latest.get(r.kind);
    if (!cur || r.at > cur.at) latest.set(r.kind, r);
  }
  for (const [kind, rule] of Object.entries(rules.environment)) {
    const r = latest.get(kind);
    if (!r || !rule) continue;
    const breach = (lim?: number) => lim !== undefined && (rule.low ? r.value <= lim : r.value >= lim);
    const level = breach(rule.action) ? 'action' : breach(rule.caution) ? 'caution' : null;
    if (!level) continue;
    out.push({
      id: `env:${kind}`,
      kind: 'screening_indicator',
      module: 'environment',
      title: `${ENV_LABEL[r.kind]} at ${level} level`,
      summary: `${r.value} ${r.unit} in ${r.location}.`,
      severity: level === 'action' ? 'high' : 'moderate',
      detectedAt: r.at,
      whatChanged: `Latest reading ${r.value} ${r.unit} at ${new Date(r.at).toLocaleTimeString()}.`,
      why: `Mission rule ${rules.version}: ${level} level ${rule.low ? '≤' : '≥'} ${level === 'action' ? rule.action : rule.caution} ${rule.unit}.`,
      contributing: [{ label: ENV_LABEL[r.kind], value: `${r.value} ${r.unit}` }],
      uncertainty: 'Environmental sensors can drift; cross-check with a second monitor.',
      nextStep: 'Follow the linked environmental protocol and inform the environmental control team.',
      status: 'new',
      method: `Mission rules ${rules.version} (demo values)`,
      protocolIds: kind === 'cabin_co2' ? ['AEG-EN-001'] : kind === 'cabin_o2' ? ['AEG-EM-002'] : undefined,
    });
  }
  // Radiation: event detection relative to the mission's expected dose rate.
  const rate = readings.filter((r) => r.kind === 'radiation_dose_rate' && now - new Date(r.at).getTime() < DAY);
  if (rate.length) {
    const peak = Math.max(...rate.map((r) => r.value));
    if (peak >= rules.expectedDoseRate * 3) {
      out.push({
        id: 'env:radiation-event',
        kind: 'screening_indicator',
        module: 'environment',
        title: 'Possible solar particle event',
        summary: `Dose rate peaked at ${peak.toFixed(2)} mSv/day — ${(peak / rules.expectedDoseRate).toFixed(1)}× the expected rate for this mission.`,
        severity: peak >= rules.expectedDoseRate * 10 ? 'critical' : 'high',
        detectedAt: rate[rate.length - 1].at,
        whatChanged: `Expected ≈ ${rules.expectedDoseRate} mSv/day.`,
        why: 'Rule: area dose rate ≥ 3× the expected mission rate within the last 24 h.',
        contributing: rate.slice(-4).map((r) => ({ label: new Date(r.at).toLocaleTimeString(), value: `${r.value.toFixed(2)} ${r.unit}` })),
        uncertainty: 'Confirm with ground space-weather forecasts and a second dosimeter.',
        nextStep: 'Follow AEG-EN-002 and coordinate with ground.',
        status: 'new',
        method: `Mission rules ${rules.version} · dose-rate rule`,
        protocolIds: ['AEG-EN-002'],
      });
    }
  }
  const cumulative = readings.filter((r) => r.kind === 'radiation_cumulative').sort((a, b) => b.at.localeCompare(a.at))[0];
  if (cumulative && cumulative.value >= rules.careerLimitMsv * 0.5) {
    out.push({
      id: 'env:career-dose',
      kind: 'screening_indicator',
      module: 'environment',
      title: 'Career radiation dose above 50% of limit',
      summary: `${cumulative.value.toFixed(0)} mSv of ${rules.careerLimitMsv} mSv.`,
      severity: cumulative.value >= rules.careerLimitMsv * 0.8 ? 'moderate' : 'info',
      detectedAt: cumulative.at,
      whatChanged: 'Cumulative effective dose updated.',
      why: `NASA-STD-3001 Vol. 1 Rev. B career limit: ${rules.careerLimitMsv} mSv effective dose.`,
      contributing: [{ label: 'Cumulative dose', value: `${cumulative.value.toFixed(0)} mSv` }],
      uncertainty: 'Effective dose is a modelled quantity.',
      nextStep: 'Review with the radiation health officer.',
      status: 'new',
      method: 'Career dose tracking',
    });
  }
  return out;
}

export const ENV_LABEL: Record<EnvironmentReading['kind'], string> = {
  radiation_dose_rate: 'Radiation dose rate',
  radiation_cumulative: 'Cumulative radiation dose',
  cabin_co2: 'Cabin CO₂',
  cabin_o2: 'Cabin O₂ partial pressure',
  cabin_pressure: 'Cabin pressure',
  cabin_temp: 'Cabin temperature',
  cabin_humidity: 'Cabin humidity',
  noise: 'Noise level',
};

/* ------------------------------------ All ------------------------------------ */

export type AnalysisInput = Ctx & { environment: EnvironmentReading[]; sleep: SleepRecord[] };

const RANK: Record<Severity, number> = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 };

export function analyse(input: AnalysisInput): Insight[] {
  const all = [
    ...ruleBreaches(input),
    ...patterns(input),
    ...baselineAnomalies(input),
    ...recovery(input.sleep, input.now),
    ...environment(input.environment, input.rules, input.now),
    ...dataQuality(input),
  ];
  // A rule breach supersedes a baseline anomaly for the same metric and direction.
  const ruleKeys = new Set(all.filter((i) => i.id.startsWith('rule:')).map((i) => i.id.replace('rule:', '')));
  return all
    .filter((i) => !(i.id.startsWith('anomaly:') && ruleKeys.has(i.id.replace('anomaly:', ''))))
    .sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}

/** Finding category shown to users — never interchangeable. */
export function findingCategory(i: Pick<Insight, 'kind'>): 'Anomaly' | 'Potential risk' | 'Confirmed finding' | 'Information' {
  if (i.kind === 'statistical_anomaly') return 'Anomaly';
  if (i.kind === 'screening_indicator' || i.kind === 'risk_estimate') return 'Potential risk';
  if (i.kind === 'confirmed_diagnosis') return 'Confirmed finding';
  return 'Information';
}
