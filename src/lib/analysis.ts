/* Copied verbatim from the CosmicPulse mobile app (src/lib/analysis.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { Insight, LabResult, Measurement, VitalType } from '@/data/types';
import { VITAL_META } from '@/data/vitals';

const DAY = 86_400_000;

export const ANOMALY_METHOD_VERSION = 'baseline-zscore v1.0 (rule-based, not a trained model)';

export function byType(ms: Measurement[], type: VitalType) {
  return ms.filter((m) => m.type === type).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}

export function latest(ms: Measurement[], type: VitalType): Measurement | undefined {
  let best: Measurement | undefined;
  for (const m of ms) if (m.type === type && (!best || m.takenAt > best.takenAt)) best = m;
  return best;
}

export function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

export function sd(xs: number[]) {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

export function within(ms: Measurement[], fromDaysAgo: number, toDaysAgo = 0, now = Date.now()) {
  return ms.filter((m) => {
    const age = (now - new Date(m.takenAt).getTime()) / DAY;
    return age <= fromDaysAgo && age >= toDaysAgo;
  });
}

/** Percent change between the 7-day mean and the prior 30-day mean. */
export function trend(ms: Measurement[], type: VitalType): { delta: number; direction: 'up' | 'down' | 'flat' } | null {
  const s = byType(ms, type).filter((m) => !m.qualityFlag);
  const recent = within(s, 7).map((m) => m.value);
  const prior = within(s, 37, 7).map((m) => m.value);
  if (recent.length < 3 || prior.length < 7) return null;
  const a = mean(recent);
  const b = mean(prior);
  const delta = ((a - b) / b) * 100;
  return { delta, direction: Math.abs(delta) < 2 ? 'flat' : delta > 0 ? 'up' : 'down' };
}

/**
 * Statistical anomaly detection against the user's own baseline.
 *
 * For each vital: baseline = readings 14–60 days ago; recent = last 7 days.
 * Flags when the recent mean sits more than 2 baseline SDs away AND the absolute
 * shift is clinically non-trivial (per-type minimum). This is a transparent rule,
 * not a trained model — the UI labels the output as a statistical anomaly.
 */
const MIN_SHIFT: Partial<Record<VitalType, number>> = {
  heart_rate: 6,
  blood_pressure: 8,
  glucose: 15,
  spo2: 2,
  weight: 2,
  sleep: 1,
  respiratory_rate: 3,
};

export function detectAnomalies(ms: Measurement[], now = Date.now()): Insight[] {
  const out: Insight[] = [];
  for (const type of Object.keys(MIN_SHIFT) as VitalType[]) {
    const s = byType(ms, type).filter((m) => !m.qualityFlag);
    const base = within(s, 60, 14, now).map((m) => m.value);
    const recentM = within(s, 7, 0, now);
    const recent = recentM.map((m) => m.value);
    if (base.length < 10 || recent.length < 3) continue;
    const mu = mean(base);
    const sigma = Math.max(sd(base), 0.5);
    const r = mean(recent);
    const z = (r - mu) / sigma;
    const shift = r - mu;
    if (Math.abs(z) < 2 || Math.abs(shift) < (MIN_SHIFT[type] ?? 0)) continue;
    const meta = VITAL_META[type];
    const dir = shift > 0 ? 'higher' : 'lower';
    const fmt = (v: number) => v.toFixed(meta.decimals);
    out.push({
      id: `anom-${type}`,
      kind: 'statistical_anomaly',
      module: type === 'blood_pressure' || type === 'heart_rate' ? 'cardiovascular' : type === 'glucose' ? 'metabolic' : 'anomaly',
      title: `${meta.label} ${dir} than your usual`,
      summary: `Your 7-day average ${meta.label.toLowerCase()} is ${fmt(r)} ${meta.unit}, compared with your usual ${fmt(mu)} ${meta.unit}.`,
      severity: Math.abs(z) > 3.5 ? 'moderate' : 'low',
      detectedAt: new Date(now).toISOString(),
      whatChanged: `Average moved from ${fmt(mu)} to ${fmt(r)} ${meta.unit} (${shift > 0 ? '+' : ''}${fmt(shift)}).`,
      why: `The recent average is ${Math.abs(z).toFixed(1)} standard deviations from your baseline (days 14–60), above the 2.0 SD flag threshold, and the shift exceeds the minimum meaningful change of ${MIN_SHIFT[type]} ${meta.unit}.`,
      contributing: [
        { label: 'Recent readings (7 days)', value: `${recent.length}`, measurementType: type },
        { label: 'Baseline readings', value: `${base.length}` },
        { label: 'Baseline average', value: `${fmt(mu)} ${meta.unit}` },
        { label: 'Recent average', value: `${fmt(r)} ${meta.unit}` },
      ],
      uncertainty:
        'Based on a small number of home readings. Illness, stress, caffeine, medication changes, device placement or a new device can all shift averages. This is a pattern in your data, not a diagnosis.',
      nextStep:
        type === 'blood_pressure' || type === 'heart_rate'
          ? 'Keep measuring at the same time each day for the next week. If the change persists, or you have chest pain, breathlessness or fainting, contact a clinician.'
          : 'Keep recording for another week and mention the change at your next appointment.',
      status: 'new',
      method: ANOMALY_METHOD_VERSION,
    });
  }

  // Data-quality findings
  for (const m of ms.filter((x) => x.qualityFlag)) {
    out.push({
      id: `quality-${m.id}`,
      kind: 'statistical_anomaly',
      module: 'anomaly',
      title: `Check this ${VITAL_META[m.type].label.toLowerCase()} reading`,
      summary: m.qualityFlag!,
      severity: 'info',
      detectedAt: m.takenAt,
      whatChanged: `A single reading of ${m.value} ${m.unit} was recorded.`,
      why: 'The value is outside the plausible range for its context or inconsistent with neighbouring readings.',
      contributing: [{ label: 'Reading', value: `${m.value} ${m.unit}`, measurementType: m.type }],
      uncertainty: 'This is a data-quality check, not a health finding.',
      nextStep: 'Edit or delete the reading if it is wrong, or repeat the measurement.',
      status: 'new',
      method: 'data-quality rules v1.0',
    });
  }
  return out;
}

/** Guideline-threshold flags. These are screening indicators, never diagnoses. */
export function guidelineFlags(ms: Measurement[], labs: LabResult[]): Insight[] {
  const out: Insight[] = [];
  const a1c = labs.filter((l) => l.test === 'HbA1c').sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
  if (a1c[0]) {
    const v = a1c[0].value;
    const prev = a1c[1]?.value;
    if (v >= 5.7) {
      out.push({
        id: 'guide-a1c',
        kind: 'screening_indicator',
        module: 'metabolic',
        title: v >= 6.5 ? 'HbA1c at or above the diabetes threshold' : 'HbA1c in the prediabetes range',
        summary: `Latest HbA1c ${v}%${prev ? ` (previous ${prev}%)` : ''}.`,
        severity: v >= 8 ? 'moderate' : 'low',
        detectedAt: a1c[0].collectedAt,
        whatChanged: prev ? `Changed by ${(v - prev).toFixed(1)} percentage points since the previous test.` : 'First recorded value.',
        why: 'American Diabetes Association criteria: 5.7–6.4% is the prediabetes range and ≥6.5% meets the diabetes threshold when confirmed. People already diagnosed have individual targets set with their clinician.',
        contributing: a1c.slice(0, 4).map((l) => ({ label: new Date(l.collectedAt).toLocaleDateString(), value: `${l.value}%` })),
        uncertainty: 'A single lab value can be affected by anaemia, recent blood loss and some haemoglobin variants.',
        nextStep: 'Review the result and your personal target with your clinician.',
        status: 'new',
        method: 'ADA Standards of Care thresholds (guideline rule)',
      });
    }
  }
  const fastingHigh = within(byType(ms, 'glucose').filter((m) => m.context === 'fasting'), 14).filter((m) => m.value >= 126);
  if (fastingHigh.length >= 3) {
    out.push({
      id: 'guide-fasting',
      kind: 'screening_indicator',
      module: 'metabolic',
      title: 'Several fasting readings above 126 mg/dL',
      summary: `${fastingHigh.length} fasting glucose readings in the past 14 days were 126 mg/dL or higher.`,
      severity: 'low',
      detectedAt: fastingHigh[fastingHigh.length - 1].takenAt,
      whatChanged: 'Repeated fasting values above the ADA fasting threshold.',
      why: 'ADA: fasting plasma glucose ≥126 mg/dL is a diagnostic threshold when confirmed by laboratory testing. Home meters are less precise than lab tests.',
      contributing: fastingHigh.slice(-4).map((m) => ({ label: new Date(m.takenAt).toLocaleDateString(), value: `${m.value} mg/dL`, measurementType: 'glucose' as const })),
      uncertainty: 'Home glucose meters may differ from lab results by up to ±15%.',
      nextStep: 'Share your log with your care team.',
      status: 'new',
      method: 'ADA fasting-glucose threshold (guideline rule)',
    });
  }
  const lows = within(byType(ms, 'glucose'), 14).filter((m) => m.value < 70);
  if (lows.length) {
    out.push({
      id: 'guide-hypo',
      kind: 'screening_indicator',
      module: 'metabolic',
      title: 'Low glucose reading recorded',
      summary: `${lows.length} reading${lows.length > 1 ? 's' : ''} below 70 mg/dL in the past 14 days.`,
      severity: lows.some((m) => m.value < 54) ? 'high' : 'moderate',
      detectedAt: lows[lows.length - 1].takenAt,
      whatChanged: `Lowest value ${Math.min(...lows.map((m) => m.value))} mg/dL.`,
      why: 'Below 70 mg/dL is classed as hypoglycaemia (level 1); below 54 mg/dL is level 2 (ADA).',
      contributing: lows.map((m) => ({ label: new Date(m.takenAt).toLocaleString(), value: `${m.value} mg/dL`, measurementType: 'glucose' as const })),
      uncertainty: 'Single meter readings can be inaccurate; symptoms matter.',
      nextStep: 'Tell your clinician about any lows, especially if you take insulin or sulfonylureas. Follow the hypoglycaemia plan your care team gave you.',
      status: 'new',
      method: 'ADA hypoglycaemia levels (guideline rule)',
    });
  }
  return out;
}

export function labFlag(l: LabResult): 'low' | 'high' | 'normal' | 'unknown' {
  if (l.refLow === undefined && l.refHigh === undefined) return 'unknown';
  if (l.refLow !== undefined && l.value < l.refLow) return 'low';
  if (l.refHigh !== undefined && l.value > l.refHigh) return 'high';
  return 'normal';
}

export function labInsights(labs: LabResult[]): Insight[] {
  const latestByTest = new Map<string, LabResult>();
  for (const l of labs) {
    const cur = latestByTest.get(l.test);
    if (!cur || l.collectedAt > cur.collectedAt) latestByTest.set(l.test, l);
  }
  const out: Insight[] = [];
  for (const l of latestByTest.values()) {
    const f = labFlag(l);
    if (f !== 'high' && f !== 'low') continue;
    if (l.test === 'HbA1c') continue; // handled by guideline rules
    const prev = labs.filter((x) => x.test === l.test && x.collectedAt < l.collectedAt).sort((a, b) => b.collectedAt.localeCompare(a.collectedAt))[0];
    out.push({
      id: `lab-${l.id}`,
      kind: 'screening_indicator',
      module: 'labs',
      title: `${l.test} ${f === 'high' ? 'above' : 'below'} reference range`,
      summary: `${l.value} ${l.unit} (reference ${l.refLow ?? '—'}–${l.refHigh ?? '—'}).`,
      severity: 'low',
      detectedAt: l.collectedAt,
      whatChanged: prev ? `Previously ${prev.value} ${prev.unit} on ${new Date(prev.collectedAt).toLocaleDateString()}.` : 'No earlier result on file.',
      why: 'The value falls outside the laboratory reference range printed on the report.',
      contributing: [{ label: l.test, value: `${l.value} ${l.unit}` }],
      uncertainty: 'Reference ranges vary between laboratories. About 1 in 20 healthy people fall outside a range on any given test.',
      nextStep: 'Discuss with the clinician who ordered the test.',
      status: 'new',
      method: 'Laboratory reference range comparison',
    });
  }
  return out;
}

export function computeInsights(ms: Measurement[], labs: LabResult[]): Insight[] {
  return [...guidelineFlags(ms, labs), ...detectAnomalies(ms), ...labInsights(labs)];
}
