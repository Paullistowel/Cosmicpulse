/* Copied verbatim from the CosmicPulse mobile app (src/engine/explain.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { HealthAlert, Insight, Measurement, Severity, VitalType } from '@/data/types';
import { VITAL_META } from '@/data/vitals';
import { persistentDays } from './analysis';
import type { Baseline } from './baseline';

/**
 * Alert explanations — deterministic. Turns an engine finding into the
 * structured explanation every alert must carry (metric, measurement, time,
 * source, real/simulated status, baseline, why, isolated vs persistent,
 * severity tier, context-specific next steps, and outcome since the alert).
 *
 * The language model may rephrase this for the user; it never decides
 * severity or thresholds. Thresholds are demonstration values and must be
 * validated by qualified medical and aerospace-health professionals before
 * operational use.
 */

export type Tier = 'informational' | 'attention' | 'medical_review' | 'urgent';

export const TIER_OF: Record<Severity, Tier> = { info: 'informational', low: 'informational', moderate: 'attention', high: 'medical_review', critical: 'urgent' };

export const TIER_COPY: Record<Tier, { label: string; meaning: string }> = {
  informational: { label: 'Informational', meaning: 'A minor change or observation that may be useful to monitor.' },
  attention: { label: 'Attention recommended', meaning: 'An unusual reading or trend that deserves attention and possible follow-up.' },
  medical_review: { label: 'Medical review recommended', meaning: 'A persistent or significant abnormality that should be reviewed by the authorised medical team.' },
  urgent: { label: 'Urgent attention', meaning: 'Potentially serious warning signs requiring prompt medical assessment under mission medical procedures.' },
};

export type DataStatus = 'real' | 'manual' | 'simulated';

export type Explanation = {
  tier: Tier;
  tierLabel: string;
  tierMeaning: string;
  metric?: VitalType;
  metricLabel: string;
  latest?: { text: string; takenAt: string; source: string; status: DataStatus };
  baseline: string;
  baselineEstablished: boolean;
  why: string;
  persistence: { kind: 'isolated' | 'repeated' | 'persistent' | 'not_applicable'; days: number; text: string };
  nextSteps: string[];
  simulated: boolean;
  outcome?: { kind: 'resolved' | 'improved' | 'persisting' | 'worsened'; text: string };
};

const fmt = (t: VitalType, v: number) => v.toFixed(VITAL_META[t].decimals);
const isSyn = (k: string) => k === 'simulated' || k === 'demo';

/** Metric a finding is about (from its id or contributing data). */
export function metricOf(f: Insight): VitalType | undefined {
  const m = f.id.match(/^(?:anomaly|rule|quality:stale):([a-z_0-9]+)/);
  if (m && m[1] in VITAL_META) return m[1] as VitalType;
  if (f.id === 'recovery:sleep-debt') return 'sleep';
  if (f.module === 'pattern') return 'heart_rate';
  return f.contributing.find((c) => c.measurementType)?.measurementType;
}

/** Direction that matters for this finding, if any. */
function directionOf(f: Insight): 'high' | 'low' | undefined {
  const m = f.id.match(/:(high|low)$/);
  if (m) return m[1] as 'high' | 'low';
  if (f.id === 'recovery:sleep-debt') return 'low';
  if (f.module === 'pattern') return 'high';
  return undefined;
}

export function statusOf(m: Measurement): DataStatus {
  return isSyn(m.source.kind) ? 'simulated' : m.source.kind === 'manual' ? 'manual' : 'real';
}

export function sourceText(m: Measurement): string {
  switch (m.source.kind) {
    case 'manual':
      return 'Entered manually';
    case 'clinician':
      return `Clinician (${m.source.name})`;
    case 'import':
      return 'Imported document';
    case 'demo':
      return 'Simulated demo data';
    default:
      return `${m.source.deviceName}${m.source.kind === 'simulated' ? ' — SIMULATED' : m.source.kind === 'live' ? ' (live sensor)' : ' (synced)'}`;
  }
}

/* --------------------------- context-specific steps --------------------------- */

const STEPS: Partial<Record<VitalType | 'pattern' | 'data_quality' | 'environment', string[]>> = {
  heart_rate: [
    'Verify the reading: rest seated for 5 minutes and measure again with the same or a second device.',
    'Review recent context — exercise timing, sleep, caffeine, workload, heat and hydration — which all raise heart rate.',
    'Check whether the change persists in your next readings rather than relying on one value.',
  ],
  hrv: [
    'Compare with recent sleep and training load — short sleep and hard sessions lower HRV.',
    'Measure at the same time each morning; HRV varies a lot across the day.',
    'Note that Apple (SDNN) and Fitbit/Android (RMSSD) HRV values are different measures and are not directly comparable.',
  ],
  spo2: [
    'Verify immediately with an approved pulse oximeter: warm hands, stay still, finger fully in the probe.',
    'Check signal quality — cold fingers, motion, nail polish and poor fit cause falsely low readings.',
    'If low readings are confirmed, or you have breathlessness, chest pain or confusion, follow the medical escalation procedure (AEG-EM-002).',
  ],
  temperature: [
    'Identify what was measured: Apple Watch reports a wrist-temperature deviation during sleep, not core body temperature.',
    'Confirm with a core or oral thermometer before drawing conclusions; wrist and skin values follow room temperature and bedding.',
    'If a raised core temperature is confirmed or you feel unwell, report it to the crew medical officer.',
  ],
  respiratory_rate: [
    'Re-measure at rest; talking, movement and recent exercise raise breathing rate.',
    'Note any breathlessness, cough or chest discomfort alongside the reading.',
    'Report a persistent rise or any breathing difficulty to the medical team.',
  ],
  blood_pressure: [
    'Re-measure after 5 minutes seated, back supported, cuff at heart level, arm resting — take two readings a minute apart.',
    'Confirm the cuff size and that the reading came from a validated monitor (Apple Watch does not measure blood pressure).',
    'Share repeated high or low readings with the authorised medical team.',
  ],
  sleep: [
    'Review your sleep history for the last week: duration, consistency of bed/wake times and disruptions.',
    'Protect the next sleep window: darkness, quiet, cool temperature, and no screens or caffeine late in the day.',
    'Review noise, light and CO₂ in the sleep station; report ongoing poor sleep or daytime impairment.',
  ],
  weight: ['Weigh at the same time of day under the same conditions.', 'Discuss sustained loss or gain with the medical team.'],
  pattern: [
    'Summarise how you feel: fatigue, sore throat, aches, fever or poor sleep.',
    'Rest and hydrate, and re-check the involved readings within 12 hours.',
    'Several signals changing together warrant review by the authorised medical team.',
  ],
  data_quality: ['Check the sensor battery, fit and connection, or take a manual reading.', 'Analysis of this metric is paused until valid data resumes.'],
  environment: ['Follow the linked environmental protocol and inform the crew.'],
};

const TIER_STEP: Record<Tier, string | undefined> = {
  informational: undefined,
  attention: 'If it persists over the next readings, mention it to the crew medical officer.',
  medical_review: 'Share these readings with the crew medical officer or flight surgeon at the next opportunity.',
  urgent: 'Act now: if you have warning symptoms (chest pain, breathlessness, fainting, confusion), use the Emergency button and follow mission medical procedures. Do not wait for more readings.',
};

/* ---------------------------------- builder ---------------------------------- */

export function explainFinding(f: Insight, ctx: { measurements: Measurement[]; baselines: Partial<Record<VitalType, Baseline>>; now: number; alert?: HealthAlert }): Explanation {
  const tier = TIER_OF[f.severity];
  const metric = metricOf(f);
  const dir = directionOf(f);
  const meta = metric ? VITAL_META[metric] : undefined;

  const series = metric ? ctx.measurements.filter((m) => m.type === metric && !m.qualityFlag && new Date(m.takenAt).getTime() <= ctx.now).sort((a, b) => a.takenAt.localeCompare(b.takenAt)) : [];
  const last = series[series.length - 1];
  const latest = last && meta
    ? { text: `${metric === 'blood_pressure' ? `${Math.round(last.value)}/${Math.round(last.value2 ?? 0)}` : fmt(metric!, last.value)} ${meta.unit}`, takenAt: last.takenAt, source: sourceText(last), status: statusOf(last) }
    : undefined;

  const b = metric ? ctx.baselines[metric] : undefined;
  const established = !!b && b.quality !== 'insufficient';
  const baseline = !metric
    ? 'Not applicable to this finding.'
    : established
      ? `Median ${fmt(metric, b!.median)} ${meta!.unit}, usual range ${fmt(metric, b!.p10)}–${fmt(metric, b!.p90)} ${meta!.unit} (${b!.quality}, ${b!.n} readings over ${b!.coverageDays} days).`
      : 'A reliable personal baseline cannot yet be established — not enough readings. The comparison uses mission reference limits instead.';

  let persistence: Explanation['persistence'] = { kind: 'not_applicable', days: 0, text: 'Not a trend-based finding.' };
  if (metric && dir && established) {
    const days = persistentDays({ measurements: ctx.measurements, baselines: ctx.baselines, rules: { version: '', vitals: {}, environment: {}, expectedIntervalH: {} } as never, now: ctx.now }, metric, dir);
    persistence =
      days >= 3
        ? { kind: 'persistent', days, text: `Persistent — outside your usual range for ${days} consecutive days.` }
        : days === 2
          ? { kind: 'repeated', days, text: 'Repeated — outside your usual range on the last 2 days; not yet persistent.' }
          : { kind: 'isolated', days, text: 'Isolated — not sustained across days. One unusual reading does not establish a medical condition.' };
  } else if (f.kind === 'screening_indicator' && f.module === 'vitals') {
    const confirmed = f.severity === 'critical';
    persistence = { kind: confirmed ? 'repeated' : 'isolated', days: 0, text: confirmed ? 'Confirmed by a second reading in the last 24 h.' : 'A single reading — not yet confirmed by a second measurement.' };
  }

  const key = f.module === 'pattern' ? 'pattern' : f.module === 'data_quality' ? 'data_quality' : f.module === 'environment' ? 'environment' : metric;
  const steps = [...(key ? (STEPS[key] ?? []) : []), ...(TIER_STEP[tier] ? [TIER_STEP[tier]!] : [])];
  if (!steps.length) steps.push(f.nextStep);
  if (f.simulated) steps.unshift('This alert comes from SIMULATED demo data — it is not about your health. The steps below show what CosmicPulse would advise for a real reading.');

  let outcome: Explanation['outcome'];
  if (ctx.alert && metric && last) {
    if (ctx.alert.state === 'resolved') outcome = { kind: 'resolved', text: 'Resolved — the condition is no longer detected.' };
    else {
      const at = new Date(ctx.alert.createdAt).getTime();
      const ref = [...series].reverse().find((m) => new Date(m.takenAt).getTime() <= at);
      if (ref && ref.id !== last.id && dir) {
        const delta = last.value - ref.value;
        const better = dir === 'high' ? delta < 0 : delta > 0;
        const small = Math.abs(delta) < (metric === 'spo2' ? 1 : metric === 'temperature' ? 0.2 : metric === 'sleep' ? 0.5 : 3);
        outcome = small
          ? { kind: 'persisting', text: `Persisting — ${fmt(metric, ref.value)} → ${fmt(metric, last.value)} ${meta!.unit} since the alert.` }
          : better
            ? { kind: 'improved', text: `Improving — ${fmt(metric, ref.value)} → ${fmt(metric, last.value)} ${meta!.unit} since the alert.` }
            : { kind: 'worsened', text: `Worsening — ${fmt(metric, ref.value)} → ${fmt(metric, last.value)} ${meta!.unit} since the alert. Seek review.` };
      } else outcome = { kind: 'persisting', text: 'No newer reading since the alert.' };
    }
  }

  return {
    tier,
    tierLabel: TIER_COPY[tier].label,
    tierMeaning: TIER_COPY[tier].meaning,
    metric,
    metricLabel: f.module === 'pattern' ? 'Multiple signals' : meta?.label ?? f.module,
    latest,
    baseline,
    baselineEstablished: established,
    why: f.why,
    persistence,
    nextSteps: steps,
    simulated: !!f.simulated,
    outcome,
  };
}
