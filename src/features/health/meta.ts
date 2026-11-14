/* Copied verbatim from the CosmicPulse mobile app (src/features/health/meta.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import {
  Activity,
  AlertTriangle,
  Bed,
  BluetoothSearching,
  CheckCircle2,
  Droplet,
  Footprints,
  Gauge,
  HeartPulse,
  RefreshCw,
  ScanHeart,
  Scale,
  Thermometer,
  Unplug,
  Watch,
  WavesHorizontal,
  Wind,
  type LucideIcon,
} from 'lucide-react-native';

import type { ConnectionState, DeviceCategory, Measurement, VitalType } from '@/data/types';
import { VITAL_META, classify, type UnitPrefs } from '@/data/vitals';
import type { Tone } from '@/theme';

/* ---------------------------------- Vitals --------------------------------- */

export const VITAL_ICON: Record<VitalType, LucideIcon> = {
  heart_rate: HeartPulse,
  hrv: Activity,
  blood_pressure: Gauge,
  glucose: Droplet,
  spo2: Wind,
  respiratory_rate: WavesHorizontal,
  temperature: Thermometer,
  weight: Scale,
  sleep: Bed,
  steps: Footprints,
  ecg: ScanHeart,
};

export const VITAL_TYPES: VitalType[] = [
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

export function isVitalType(v: unknown): v is VitalType {
  return typeof v === 'string' && (VITAL_TYPES as string[]).includes(v);
}

/* ------------------------------- Value entry ------------------------------- */

export type DialConfig = { min: number; max: number; step: number; labelEvery: number; decimals: number; initial: number };

/**
 * Ruler ranges in DISPLAY units. The dial covers the comfortable range; the
 * precise text field accepts anything within VITAL_META plausible bounds.
 */
export function dialConfig(type: VitalType, units: UnitPrefs, secondary = false): DialConfig {
  switch (type) {
    case 'heart_rate':
      return { min: 30, max: 220, step: 1, labelEvery: 10, decimals: 0, initial: 70 };
    case 'hrv':
      return { min: 5, max: 200, step: 1, labelEvery: 10, decimals: 0, initial: 50 };
    case 'blood_pressure':
      return secondary
        ? { min: 30, max: 160, step: 1, labelEvery: 10, decimals: 0, initial: 80 }
        : { min: 60, max: 260, step: 1, labelEvery: 10, decimals: 0, initial: 120 };
    case 'glucose':
      return units.glucose === 'mmol/L'
        ? { min: 2, max: 33, step: 0.1, labelEvery: 10, decimals: 1, initial: 5.5 }
        : { min: 20, max: 600, step: 1, labelEvery: 10, decimals: 0, initial: 100 };
    case 'spo2':
      return { min: 50, max: 100, step: 1, labelEvery: 10, decimals: 0, initial: 97 };
    case 'respiratory_rate':
      return { min: 5, max: 60, step: 1, labelEvery: 5, decimals: 0, initial: 16 };
    case 'temperature':
      return units.system === 'us'
        ? { min: 90, max: 109, step: 0.1, labelEvery: 10, decimals: 1, initial: 98.2 }
        : { min: 32, max: 43, step: 0.1, labelEvery: 10, decimals: 1, initial: 36.8 };
    case 'weight':
      return units.system === 'us'
        ? { min: 50, max: 500, step: 1, labelEvery: 10, decimals: 0, initial: 160 }
        : { min: 20, max: 250, step: 0.5, labelEvery: 10, decimals: 1, initial: 70 };
    case 'sleep':
      return { min: 0, max: 16, step: 0.1, labelEvery: 10, decimals: 1, initial: 7.5 };
    case 'steps':
      return { min: 0, max: 40000, step: 100, labelEvery: 10, decimals: 0, initial: 6000 };
    case 'ecg':
      return { min: 30, max: 220, step: 1, labelEvery: 10, decimals: 0, initial: 70 };
  }
}

/** Decimals accepted in the precise text field for a type, in display units. */
export function entryDecimals(type: VitalType, units: UnitPrefs): number {
  if (type === 'glucose') return units.glucose === 'mmol/L' ? 1 : 0;
  if (type === 'temperature' || type === 'weight' || type === 'sleep') return 1;
  return 0;
}

/* --------------------------------- Devices --------------------------------- */

export const DEVICE_CATEGORY: Record<DeviceCategory, { label: string; icon: LucideIcon; blurb: string }> = {
  smartwatch: { label: 'Smartwatch', icon: Watch, blurb: 'Heart rate, SpO₂, sleep and steps' },
  heart_rate_monitor: { label: 'Heart-rate strap', icon: HeartPulse, blurb: 'Heart rate' },
  bp_monitor: { label: 'Blood pressure monitor', icon: Gauge, blurb: 'Blood pressure and pulse' },
  pulse_oximeter: { label: 'Pulse oximeter', icon: Wind, blurb: 'SpO₂ and pulse' },
  thermometer: { label: 'Thermometer', icon: Thermometer, blurb: 'Body temperature' },
  ecg: { label: 'ECG recorder', icon: ScanHeart, blurb: 'ECG recordings and heart rate' },
  cgm: { label: 'Glucose monitor (CGM)', icon: Droplet, blurb: 'Glucose' },
  scale: { label: 'Smart scale', icon: Scale, blurb: 'Weight' },
};

export const DEVICE_CATEGORIES = Object.keys(DEVICE_CATEGORY) as DeviceCategory[];

export const DEVICE_STATE: Record<ConnectionState, { label: string; tone: Tone; icon: LucideIcon }> = {
  connected: { label: 'Connected', tone: 'success', icon: CheckCircle2 },
  syncing: { label: 'Syncing', tone: 'info', icon: RefreshCw },
  pairing: { label: 'Pairing', tone: 'info', icon: BluetoothSearching },
  disconnected: { label: 'Disconnected', tone: 'neutral', icon: Unplug },
  error: { label: 'Needs attention', tone: 'critical', icon: AlertTriangle },
};

export function batteryTone(b?: number): Tone {
  if (b === undefined) return 'neutral';
  if (b < 15) return 'critical';
  if (b < 30) return 'warning';
  return 'neutral';
}

/* ------------------------------ Reading guidance ----------------------------- */

/** ADA fasting glucose band (display only, not a diagnosis). Input in mg/dL. */
export function fastingGlucoseCategory(mgdl: number): string {
  if (mgdl < 70) return 'Below range';
  if (mgdl < 100) return 'Normal fasting range';
  if (mgdl < 126) return 'Prediabetes range';
  return 'Diabetes-threshold range';
}

export type ReadingGuidance = { title: string; body: string; urgent: boolean };

/**
 * Plain-language, non-diagnostic guidance for a single reading, derived from
 * the configured threshold bands. Never suggests medication or dosing — the
 * escalation path is always the crew medical officer / flight surgeon.
 */
export function readingGuidance(m: Pick<Measurement, 'type' | 'value' | 'value2' | 'context'>): ReadingGuidance | null {
  const band = classify(m);
  if (!band) return null;
  const label = VITAL_META[m.type].label.toLowerCase();
  if (band.tone === 'critical') {
    return {
      title: `${band.label}: act now`,
      body: `This ${label} reading is outside the safe range. Re-measure once to rule out a sensor fault, then start emergency assistance and alert your crew medical officer. Do not wait for a trend.`,
      urgent: true,
    };
  }
  if (band.tone === 'warning') {
    return {
      title: band.label,
      body: `This ${label} reading is outside your usual range. Re-measure at rest in 10–15 minutes. If it persists or you feel unwell, report it to your crew medical officer.`,
      urgent: false,
    };
  }
  return null;
}

export { bpCategory } from '@/data/vitals';
