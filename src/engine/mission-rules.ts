/* Copied verbatim from the CosmicPulse mobile app (src/engine/mission-rules.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { EnvironmentKind, MissionType, VitalType } from '@/data/types';

/**
 * Mission rules — thresholds that come from flight rules rather than from an
 * individual's baseline.
 *
 * DEMO VALUES. The environmental and vital action levels below are
 * illustrative and must be replaced by the mission's approved flight rules.
 * Reference values that are drawn from published sources are cited inline.
 */
export type MissionRules = {
  version: string;
  vitals: Partial<Record<VitalType, { cautionLow?: number; cautionHigh?: number; actionLow?: number; actionHigh?: number }>>;
  environment: Partial<Record<EnvironmentKind, { caution?: number; action?: number; low?: boolean; unit: string }>>;
  /** Expected daily effective dose for the mission type (mSv/day), used to spot radiation events. */
  expectedDoseRate: number;
  /** Career effective dose limit (mSv). NASA-STD-3001 Vol. 1 Rev. B sets 600 mSv. */
  careerLimitMsv: number;
  /** Expected sample interval per vital (hours) — used for stale-sensor detection. */
  expectedIntervalH: Partial<Record<VitalType, number>>;
};

/**
 * Typical daily dose rates (approximate, for display and event detection only):
 * - ISS / LEO: ~0.3–0.8 mSv/day (NASA public figures, ~50–150 mSv per 6-month increment).
 * - Lunar surface: ~1.4 mSv/day (Chang'e-4 LND, Zhang et al., Science Advances 2020).
 * - Mars transit / deep space: ~1.8 mSv/day (MSL RAD cruise, Zeitlin et al., Science 2013).
 * - Mars surface: ~0.64 mSv/day (MSL RAD, Hassler et al., Science 2014).
 */
const DOSE: Record<MissionType, number> = {
  iss: 0.5,
  leo: 0.5,
  lunar_orbit: 1.3,
  lunar_surface: 1.4,
  mars_transit: 1.8,
  mars_surface: 0.64,
  deep_space: 1.8,
};

const BASE: Omit<MissionRules, 'expectedDoseRate'> = {
  version: '0.1.0-demo',
  vitals: {
    spo2: { cautionLow: 94, actionLow: 90 },
    heart_rate: { cautionHigh: 120, actionHigh: 140, cautionLow: 45, actionLow: 40 },
    temperature: { cautionHigh: 37.8, actionHigh: 38.5, actionLow: 35 },
    respiratory_rate: { cautionHigh: 22, actionHigh: 28, actionLow: 8 },
    blood_pressure: { cautionHigh: 140, actionHigh: 170, cautionLow: 90 },
  },
  environment: {
    cabin_co2: { caution: 3.0, action: 4.0, unit: 'mmHg' },
    cabin_o2: { caution: 19.5, action: 18.0, low: true, unit: 'kPa' },
    cabin_pressure: { caution: 95, action: 90, low: true, unit: 'kPa' },
    cabin_temp: { caution: 27, action: 29, unit: '°C' },
    cabin_humidity: { caution: 70, action: 75, unit: '%' },
    noise: { caution: 60, action: 70, unit: 'dBA' },
  },
  careerLimitMsv: 600,
  expectedIntervalH: { heart_rate: 6, hrv: 24, spo2: 12, temperature: 24, respiratory_rate: 12, blood_pressure: 24, sleep: 24 },
};

export function rulesFor(type: MissionType): MissionRules {
  return { ...BASE, expectedDoseRate: DOSE[type] };
}

export const MISSION_TYPE_LABEL: Record<MissionType, string> = {
  iss: 'International Space Station',
  leo: 'Low Earth orbit',
  lunar_orbit: 'Lunar orbit',
  lunar_surface: 'Lunar surface',
  mars_transit: 'Mars transit',
  mars_surface: 'Mars surface',
  deep_space: 'Deep space',
};
