/* Copied verbatim from the CosmicPulse mobile app (src/engine/risk.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { AutonomyLevel, Insight, Severity, VitalType } from '@/data/types';
import type { Baseline } from './baseline';
import { deviation } from './analysis';
import type { MissionRules } from './mission-rules';
import type { Measurement, SleepRecord } from '@/data/types';

/**
 * CosmicPulse Risk Assessment Engine.
 *
 * Combines findings into an overall status with an explicit escalation
 * recommendation. The mapping is a transparent rule table — it is not a
 * validated clinical risk model, and the UI says so.
 */

export type RiskLevel = 'nominal' | 'monitor' | 'elevated' | 'high' | 'critical';

export type RiskAssessment = {
  level: RiskLevel;
  drivers: Insight[];
  escalation: 'none' | 'self_monitor' | 'crew_medical_officer' | 'flight_surgeon' | 'emergency';
  escalationText: string;
  method: string;
};

const LEVEL_BY_SEVERITY: Record<Severity, RiskLevel> = { info: 'nominal', low: 'monitor', moderate: 'elevated', high: 'high', critical: 'critical' };
const ORDER: RiskLevel[] = ['nominal', 'monitor', 'elevated', 'high', 'critical'];

export function assessRisk(findings: Insight[]): RiskAssessment {
  const relevant = findings.filter((f) => f.status !== 'dismissed' && f.module !== 'data_quality');
  let level: RiskLevel = 'nominal';
  for (const f of relevant) {
    const l = LEVEL_BY_SEVERITY[f.severity];
    if (ORDER.indexOf(l) > ORDER.indexOf(level)) level = l;
  }
  // Several concurrent moderate findings warrant clinician review even without a single high one.
  if (level === 'elevated' && relevant.filter((f) => f.severity === 'moderate').length >= 3) level = 'high';
  const escalation: RiskAssessment['escalation'] =
    level === 'critical' ? 'emergency' : level === 'high' ? 'flight_surgeon' : level === 'elevated' ? 'crew_medical_officer' : level === 'monitor' ? 'self_monitor' : 'none';
  const ESC: Record<RiskAssessment['escalation'], string> = {
    none: 'No action needed. Routine monitoring continues.',
    self_monitor: 'Keep monitoring; no escalation needed yet.',
    crew_medical_officer: 'Review with the crew medical officer today.',
    flight_surgeon: 'Notify the flight surgeon at the next communication opportunity (priority).',
    emergency: 'Begin the linked emergency protocol and contact the flight surgeon on the priority channel now.',
  };
  return {
    level,
    drivers: relevant.filter((f) => LEVEL_BY_SEVERITY[f.severity] === level).slice(0, 4),
    escalation,
    escalationText: ESC[escalation],
    method: 'Highest-severity rule with a multi-finding modifier (aegis-risk 1.0.0, not clinically validated)',
  };
}

/* --------------------------------- Readiness --------------------------------- */

export type Readiness = {
  /** 0–100, or null when there is not enough baseline data. */
  score: number | null;
  label: 'Ready' | 'Reduced' | 'Low' | 'Insufficient data';
  components: { label: string; points: number; max: number; detail: string }[];
  method: string;
};

/**
 * Readiness index — a transparent, rule-based summary of recovery state
 * built from deviations against the personal baseline. Not a validated score;
 * each component is shown so the astronaut can see exactly why.
 */
export function readiness(input: {
  measurements: Measurement[];
  baselines: Partial<Record<VitalType, Baseline>>;
  rules: MissionRules;
  sleep: SleepRecord[];
  activeAlerts: number;
  now: number;
}): Readiness {
  const ctx = { measurements: input.measurements, baselines: input.baselines, rules: input.rules, now: input.now };
  const hrv = deviation(ctx, 'hrv', 2);
  const hr = deviation(ctx, 'heart_rate', 2);
  const lastSleep = [...input.sleep].sort((a, b) => b.night.localeCompare(a.night))[0];
  const comps: Readiness['components'] = [];
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  if (hrv) comps.push({ label: 'HRV vs baseline', max: 35, points: Math.round(clamp(35 + hrv.z * 10, 0, 35)), detail: `z ${hrv.z.toFixed(1)}` });
  if (hr) comps.push({ label: 'Resting HR vs baseline', max: 25, points: Math.round(clamp(25 - Math.max(0, hr.z) * 8, 0, 25)), detail: `z ${hr.z.toFixed(1)}` });
  if (lastSleep) comps.push({ label: 'Last sleep', max: 30, points: Math.round(clamp((lastSleep.hours / 7) * 22 + (lastSleep.quality / 100) * 8, 0, 30)), detail: `${lastSleep.hours.toFixed(1)} h · quality ${lastSleep.quality}` });
  comps.push({ label: 'Open alerts', max: 10, points: clamp(10 - input.activeAlerts * 4, 0, 10), detail: `${input.activeAlerts} active` });
  if (comps.length < 3) {
    return { score: null, label: 'Insufficient data', components: comps, method: 'Needs HRV, heart-rate and sleep data with an established baseline.' };
  }
  const max = comps.reduce((a, c) => a + c.max, 0);
  const score = Math.round((comps.reduce((a, c) => a + c.points, 0) / max) * 100);
  return {
    score,
    label: score >= 75 ? 'Ready' : score >= 55 ? 'Reduced' : 'Low',
    components: comps,
    method: 'cosmicpulse-readiness 1.0.0 — rule-based index from baseline deviations; not clinically validated',
  };
}

export const AUTONOMY_COPY: Record<AutonomyLevel, { name: string; does: string; never: string }> = {
  1: { name: 'Monitoring', does: 'Collects and displays health data. No interpretation or alerts.', never: 'Never interprets or recommends.' },
  2: { name: 'Interpretation', does: 'Adds baselines, anomaly detection and alerts.', never: 'Never recommends procedures.' },
  3: { name: 'Decision support', does: 'Adds approved protocol recommendations to each finding.', never: 'Never prescribes, doses or intervenes.' },
  4: { name: 'Workflow coordination', does: 'Also escalates high-severity alerts to the flight surgeon automatically and queues reports.', never: 'Never prescribes, doses or intervenes. Escalation only.' },
};
