/* Copied verbatim from the CosmicPulse mobile app (src/data/vitals.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { Measurement, MeasurementContext, VitalType } from './types';

export type UnitSystem = 'metric' | 'us';
export type GlucoseUnit = 'mg/dL' | 'mmol/L';

export type Band = { label: string; tone: 'success' | 'warning' | 'critical' | 'info' };

export type VitalMeta = {
  type: VitalType;
  label: string;
  shortLabel: string;
  /** Canonical storage unit. */
  unit: string;
  decimals: number;
  /** Physiologically plausible bounds used for input validation. */
  plausible: [number, number];
  plausible2?: [number, number];
  /** Typical adult reference range, displayed as a band on charts. */
  typical?: [number, number];
  reference: string;
  contexts: MeasurementContext[];
  manualEntry: boolean;
  about: string;
};

/**
 * Reference ranges are general adult guideline values for display only.
 * A clinician-configured threshold (settings store) always takes precedence.
 */
export const VITAL_META: Record<VitalType, VitalMeta> = {
  heart_rate: {
    type: 'heart_rate',
    label: 'Heart rate',
    shortLabel: 'Heart rate',
    unit: 'bpm',
    decimals: 0,
    plausible: [25, 250],
    typical: [60, 100],
    reference: 'Typical resting adult range 60–100 bpm (American Heart Association).',
    contexts: ['resting', 'after_activity', 'unspecified'],
    manualEntry: true,
    about:
      'Resting heart rate varies with fitness, medication, caffeine, stress and illness. Trends over weeks are more informative than single readings.',
  },
  hrv: {
    type: 'hrv',
    label: 'Heart-rate variability',
    shortLabel: 'HRV',
    unit: 'ms',
    decimals: 0,
    plausible: [3, 300],
    reference:
      'RMSSD. HRV varies widely between individuals, so CosmicPulse compares it only with your own baseline — never with a population range.',
    contexts: ['resting', 'morning', 'unspecified'],
    manualEntry: true,
    about:
      'Lower-than-usual HRV can accompany fatigue, illness, stress or poor sleep. Measure at the same time each day (ideally on waking) for comparable values.',
  },
  blood_pressure: {
    type: 'blood_pressure',
    label: 'Blood pressure',
    shortLabel: 'BP',
    unit: 'mmHg',
    decimals: 0,
    plausible: [60, 260],
    plausible2: [30, 160],
    typical: [90, 120],
    reference:
      'Categories follow the 2017 ACC/AHA guideline: normal <120/<80, elevated 120–129/<80, stage 1 130–139 or 80–89, stage 2 ≥140 or ≥90.',
    contexts: ['morning', 'evening', 'resting', 'unspecified'],
    manualEntry: true,
    about:
      'Measure seated after 5 minutes of rest, arm supported at heart level. CosmicPulse records readings and helps you share them — it does not regulate or treat blood pressure.',
  },
  glucose: {
    type: 'glucose',
    label: 'Blood glucose',
    shortLabel: 'Glucose',
    unit: 'mg/dL',
    decimals: 0,
    plausible: [20, 600],
    typical: [70, 140],
    reference:
      'ADA: fasting 70–99 mg/dL typical; 100–125 is the prediabetes range; ≥126 on repeat testing meets the diabetes threshold. <70 mg/dL is low.',
    contexts: ['fasting', 'pre_meal', 'post_meal', 'bedtime', 'random'],
    manualEntry: true,
    about:
      'Glucose depends heavily on timing. Always record whether a reading was fasting or after a meal so trends can be compared fairly.',
  },
  spo2: {
    type: 'spo2',
    label: 'Blood oxygen',
    shortLabel: 'SpO₂',
    unit: '%',
    decimals: 0,
    plausible: [50, 100],
    typical: [95, 100],
    reference:
      'Most healthy adults read 95–100%. Pulse oximeters can overestimate saturation in people with darker skin (FDA safety communication, 2021).',
    contexts: ['resting', 'after_activity', 'unspecified'],
    manualEntry: true,
    about:
      'Cold fingers, nail polish, movement and poor perfusion can lower readings. Repeat a surprising value before acting on it.',
  },
  respiratory_rate: {
    type: 'respiratory_rate',
    label: 'Respiratory rate',
    shortLabel: 'Resp. rate',
    unit: 'br/min',
    decimals: 0,
    plausible: [4, 60],
    typical: [12, 20],
    reference: 'Typical resting adult range 12–20 breaths per minute.',
    contexts: ['resting', 'unspecified'],
    manualEntry: true,
    about: 'Count breaths for a full minute while at rest.',
  },
  temperature: {
    type: 'temperature',
    label: 'Temperature',
    shortLabel: 'Temp',
    unit: '°C',
    decimals: 1,
    plausible: [32, 43],
    typical: [36.1, 37.2],
    reference: 'Typical oral temperature 36.1–37.2 °C; 38.0 °C or higher is generally considered a fever.',
    contexts: ['morning', 'evening', 'unspecified'],
    manualEntry: true,
    about: 'Readings vary by site (oral, ear, forehead) and time of day.',
  },
  weight: {
    type: 'weight',
    label: 'Weight',
    shortLabel: 'Weight',
    unit: 'kg',
    decimals: 1,
    plausible: [20, 350],
    reference: 'Weigh at the same time of day, ideally in the morning, for comparable trends.',
    contexts: ['morning', 'evening', 'unspecified'],
    manualEntry: true,
    about: 'Day-to-day changes are mostly fluid. Weekly averages are more meaningful.',
  },
  sleep: {
    type: 'sleep',
    label: 'Sleep',
    shortLabel: 'Sleep',
    unit: 'h',
    decimals: 1,
    plausible: [0, 20],
    typical: [7, 9],
    reference: 'Adults are advised to get 7 or more hours per night (AASM / CDC).',
    contexts: ['unspecified'],
    manualEntry: true,
    about: 'Wearable sleep estimates are approximate and may misclassify quiet wakefulness as sleep.',
  },
  steps: {
    type: 'steps',
    label: 'Activity',
    shortLabel: 'Steps',
    unit: 'steps',
    decimals: 0,
    plausible: [0, 100000],
    reference: 'Any increase in daily movement is associated with health benefits.',
    contexts: ['unspecified'],
    manualEntry: true,
    about: 'Step counts are estimates and vary between devices.',
  },
  ecg: {
    type: 'ecg',
    label: 'ECG',
    shortLabel: 'ECG',
    unit: 'bpm',
    decimals: 0,
    plausible: [25, 250],
    reference:
      'ECG recordings are shown only from a supported, cleared device. CosmicPulse does not interpret rhythms itself.',
    contexts: ['resting'],
    manualEntry: false,
    about:
      'Single-lead consumer ECGs cannot rule out a heart attack or detect every arrhythmia. Recordings should be reviewed by a clinician.',
  },
};

export const VITAL_ORDER: VitalType[] = [
  'heart_rate',
  'hrv',
  'blood_pressure',
  'glucose',
  'spo2',
  'respiratory_rate',
  'temperature',
  'weight',
  'sleep',
  'steps',
  'ecg',
];

export const CONTEXT_LABEL: Record<MeasurementContext, string> = {
  fasting: 'Fasting',
  pre_meal: 'Before meal',
  post_meal: 'After meal',
  bedtime: 'Bedtime',
  random: 'Random',
  resting: 'Resting',
  after_activity: 'After activity',
  morning: 'Morning',
  evening: 'Evening',
  unspecified: 'Not specified',
};

/* ---------------------------- Unit conversion ---------------------------- */

const MGDL_PER_MMOL = 18.0;

export const convert = {
  glucoseToDisplay: (mgdl: number, unit: GlucoseUnit) =>
    unit === 'mmol/L' ? Math.round((mgdl / MGDL_PER_MMOL) * 10) / 10 : Math.round(mgdl),
  glucoseToCanonical: (v: number, unit: GlucoseUnit) => (unit === 'mmol/L' ? v * MGDL_PER_MMOL : v),
  tempToDisplay: (c: number, sys: UnitSystem) => (sys === 'us' ? Math.round((c * 9) / 5 * 10 + 320) / 10 : c),
  tempToCanonical: (v: number, sys: UnitSystem) => (sys === 'us' ? ((v - 32) * 5) / 9 : v),
  weightToDisplay: (kg: number, sys: UnitSystem) => (sys === 'us' ? Math.round(kg * 2.20462 * 10) / 10 : kg),
  weightToCanonical: (v: number, sys: UnitSystem) => (sys === 'us' ? v / 2.20462 : v),
};

export type UnitPrefs = { system: UnitSystem; glucose: GlucoseUnit };

export function displayUnit(type: VitalType, prefs: UnitPrefs): string {
  if (type === 'glucose') return prefs.glucose;
  if (type === 'temperature') return prefs.system === 'us' ? '°F' : '°C';
  if (type === 'weight') return prefs.system === 'us' ? 'lb' : 'kg';
  return VITAL_META[type].unit;
}

export function toDisplay(type: VitalType, v: number, prefs: UnitPrefs): number {
  if (type === 'glucose') return convert.glucoseToDisplay(v, prefs.glucose);
  if (type === 'temperature') return convert.tempToDisplay(v, prefs.system);
  if (type === 'weight') return convert.weightToDisplay(v, prefs.system);
  return v;
}

export function toCanonical(type: VitalType, v: number, prefs: UnitPrefs): number {
  if (type === 'glucose') return convert.glucoseToCanonical(v, prefs.glucose);
  if (type === 'temperature') return convert.tempToCanonical(v, prefs.system);
  if (type === 'weight') return convert.weightToCanonical(v, prefs.system);
  return v;
}

export function formatValue(m: Pick<Measurement, 'type' | 'value' | 'value2'>, prefs: UnitPrefs): string {
  if (m.type === 'blood_pressure') return `${Math.round(m.value)}/${Math.round(m.value2 ?? 0)}`;
  if (m.type === 'steps') return Math.round(m.value).toLocaleString('en-US');
  const v = toDisplay(m.type, m.value, prefs);
  const decimals = m.type === 'glucose' && prefs.glucose === 'mmol/L' ? 1 : VITAL_META[m.type].decimals;
  return v.toFixed(decimals);
}

/* ------------------------------ Classification ----------------------------- */

export type Thresholds = {
  bpSystolicHigh: number;
  bpDiastolicHigh: number;
  glucoseLow: number;
  glucoseHigh: number;
  hrLow: number;
  hrHigh: number;
  spo2Low: number;
};

/** Defaults; a clinician can override via Settings → Health profile → Thresholds. */
export const DEFAULT_THRESHOLDS: Thresholds = {
  bpSystolicHigh: 130,
  bpDiastolicHigh: 80,
  glucoseLow: 70,
  glucoseHigh: 180,
  hrLow: 50,
  hrHigh: 100,
  spo2Low: 94,
};

/** Returns a non-diagnostic band for display. Never use to diagnose. */
export function classify(m: Pick<Measurement, 'type' | 'value' | 'value2' | 'context'>, t: Thresholds = DEFAULT_THRESHOLDS): Band | null {
  switch (m.type) {
    case 'blood_pressure': {
      const s = m.value;
      const d = m.value2 ?? 0;
      if (s >= 180 || d >= 120) return { label: 'Very high — see guidance', tone: 'critical' };
      if (s >= 140 || d >= 90) return { label: 'Stage 2 range', tone: 'warning' };
      if (s >= t.bpSystolicHigh || d >= t.bpDiastolicHigh) return { label: 'Above your threshold', tone: 'warning' };
      if (s >= 120) return { label: 'Elevated range', tone: 'info' };
      if (s < 90 || d < 60) return { label: 'Lower than typical', tone: 'info' };
      return { label: 'Within typical range', tone: 'success' };
    }
    case 'glucose': {
      if (m.value < 54) return { label: 'Very low — act now', tone: 'critical' };
      if (m.value < t.glucoseLow) return { label: 'Low', tone: 'warning' };
      if (m.context === 'fasting') {
        if (m.value >= 126) return { label: 'Above fasting threshold', tone: 'warning' };
        if (m.value >= 100) return { label: 'Prediabetes range (fasting)', tone: 'info' };
        return { label: 'Typical fasting range', tone: 'success' };
      }
      if (m.value > 300) return { label: 'Very high', tone: 'critical' };
      if (m.value > t.glucoseHigh) return { label: 'Above your threshold', tone: 'warning' };
      return { label: 'Within your range', tone: 'success' };
    }
    case 'heart_rate': {
      if (m.value > 130 || m.value < 40) return { label: 'Outside typical resting range', tone: 'warning' };
      if (m.value > t.hrHigh) return { label: 'Above typical resting range', tone: 'info' };
      if (m.value < t.hrLow) return { label: 'Below typical resting range', tone: 'info' };
      return { label: 'Within typical range', tone: 'success' };
    }
    case 'spo2': {
      if (m.value < 90) return { label: 'Low — repeat & seek advice', tone: 'critical' };
      if (m.value < t.spo2Low) return { label: 'Lower than typical', tone: 'warning' };
      return { label: 'Within typical range', tone: 'success' };
    }
    case 'temperature': {
      if (m.value >= 39.5) return { label: 'High fever range', tone: 'warning' };
      if (m.value >= 38) return { label: 'Fever range', tone: 'warning' };
      if (m.value < 35) return { label: 'Low — seek advice', tone: 'critical' };
      return { label: 'Within typical range', tone: 'success' };
    }
    case 'respiratory_rate': {
      if (m.value > 24 || m.value < 10) return { label: 'Outside typical range', tone: 'warning' };
      return { label: 'Within typical range', tone: 'success' };
    }
    case 'sleep': {
      if (m.value < 6) return { label: 'Short sleep', tone: 'info' };
      return null;
    }
    default:
      return null;
  }
}

/** ACC/AHA 2017 blood-pressure category label (display only, not a diagnosis). */
export function bpCategory(systolic: number, diastolic: number): string {
  if (systolic >= 180 || diastolic >= 120) return 'Very high range — see guidance';
  if (systolic >= 140 || diastolic >= 90) return 'Stage 2 range';
  if (systolic >= 130 || diastolic >= 80) return 'Stage 1 range';
  if (systolic >= 120) return 'Elevated range';
  return 'Normal range';
}
