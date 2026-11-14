import type { EnvironmentReading, ExerciseSession, Insight, Measurement, Mission, MoodEntry, SleepRecord, VitalType } from '@/data/types';
import { deviation, type Baseline, type MissionRules } from '@/engine';
import { HAZARDS, HAZARD_BY_ID, hazardsForMetric, type HazardId } from '@/research/hazards';
import type { EvidenceRef } from '@/research/sources';
import type { ConfinementCheckin } from './checkins';

/**
 * Personal hazard profile — connects THIS astronaut's recent data to the five
 * NASA spaceflight hazards.
 *
 * Deterministic, offline, explainable. It answers "which of my recent changes
 * are relevant to which hazard, and why does NASA study that?" — it never says
 * an astronaut has a condition. Each signal names the data it used and the
 * evidence it links to. Thresholds are prototype values (documented in
 * docs/HEALTH_ANALYSIS.md), not clinically validated limits.
 */

export const HAZARD_ENGINE_VERSION = 'cosmicpulse-hazard-link 1.0.0 (rule-based prototype)';

export type SignalLevel = 'watch' | 'attention';

export type HazardSignal = {
  id: string;
  label: string;
  detail: string;
  level: SignalLevel;
  metric?: VitalType;
  /** Data the rule used, in plain language. */
  data: string;
  evidence: EvidenceRef[];
  synthetic: boolean;
};

export type HazardStatus = 'no_signal' | 'watch' | 'attention' | 'insufficient';

export type HazardProfile = {
  hazard: HazardId;
  status: HazardStatus;
  signals: HazardSignal[];
  findings: Insight[];
  /** Plain-language explanation tying signals to the hazard. */
  narrative: string;
};

export type HazardInput = {
  mission: Mission;
  measurements: Measurement[];
  baselines: Partial<Record<VitalType, Baseline>>;
  rules: MissionRules;
  findings: Insight[];
  sleep: SleepRecord[];
  exercise: ExerciseSession[];
  environment: EnvironmentReading[];
  moods: MoodEntry[];
  checkins: ConfinementCheckin[];
  linkOnline: boolean;
  now: number;
};

const DAY = 86_400_000;
const syn = (k: string) => k === 'simulated' || k === 'demo';
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const within = (iso: string, now: number, fromDays: number, toDays = 0) => {
  const t = new Date(iso).getTime();
  return t <= now - toDays * DAY && t > now - fromDays * DAY;
};

/* ------------------------------ Individual signals ------------------------------ */

export function sleepSignal(sleep: SleepRecord[], now: number): HazardSignal | null {
  const recent = sleep.filter((r) => within(r.night, now, 5));
  const prior = sleep.filter((r) => within(r.night, now, 19, 5));
  if (recent.length < 3) return null;
  const r = avg(recent.map((x) => x.hours));
  const p = prior.length >= 5 ? avg(prior.map((x) => x.hours)) : 7;
  const drop = p - r;
  if (r >= 6.5 && drop < 0.75) return null;
  const level: SignalLevel = r < 6 || drop >= 1.5 ? 'attention' : 'watch';
  return {
    id: 'sleep',
    label: 'Reduced sleep',
    detail: `Average ${r.toFixed(1)} h over the last ${recent.length} nights vs ${p.toFixed(1)} h before${prior.length < 5 ? ' (7 h target — not enough earlier nights)' : ''}.`,
    level,
    metric: 'sleep',
    data: `${recent.length} recent + ${prior.length} earlier sleep records`,
    evidence: ['nasa-hrp-risks#grouping', 'nasa-hrp-research#artemis'],
    synthetic: recent.every((x) => syn(x.source.kind)),
  };
}

export function moodSignals(moods: MoodEntry[], now: number): HazardSignal[] {
  const recent = moods.filter((m) => within(m.at, now, 7));
  const prior = moods.filter((m) => within(m.at, now, 28, 7));
  if (recent.length < 2) return [];
  const out: HazardSignal[] = [];
  const rm = avg(recent.map((m) => m.mood));
  const pm = prior.length >= 3 ? avg(prior.map((m) => m.mood)) : NaN;
  if ((Number.isFinite(pm) && pm - rm >= 0.7) || rm <= 2.2) {
    out.push({
      id: 'mood',
      label: 'Lower mood',
      detail: `Mood ${rm.toFixed(1)}/5 this week${Number.isFinite(pm) ? ` vs ${pm.toFixed(1)}/5 in the previous three weeks` : ''}.`,
      level: rm <= 2 ? 'attention' : 'watch',
      data: `${recent.length} check-ins this week, ${prior.length} earlier`,
      evidence: ['nasa-hrp-hazards#isolation', 'nasa-hrp-risks#approach'],
      synthetic: false,
    });
  }
  const rs = avg(recent.map((m) => m.stress));
  const ps = prior.length >= 3 ? avg(prior.map((m) => m.stress)) : NaN;
  if ((Number.isFinite(ps) && rs - ps >= 0.7) || rs >= 4) {
    out.push({
      id: 'stress',
      label: 'Higher stress',
      detail: `Stress ${rs.toFixed(1)}/5 this week${Number.isFinite(ps) ? ` vs ${ps.toFixed(1)}/5 before` : ''}.`,
      level: rs >= 4.3 ? 'attention' : 'watch',
      data: `${recent.length} check-ins this week, ${prior.length} earlier`,
      evidence: ['nasa-hrp-hazards#isolation', 'nasa-hrp-risks#grouping'],
      synthetic: false,
    });
  }
  return out;
}

export function exerciseSignal(exercise: ExerciseSession[], now: number): HazardSignal | null {
  const recent = exercise.filter((x) => within(x.at, now, 7));
  const prior = exercise.filter((x) => within(x.at, now, 21, 7));
  if (prior.length < 4) return null;
  const r = recent.reduce((a, x) => a + x.minutes, 0) / 7;
  const p = prior.reduce((a, x) => a + x.minutes, 0) / 14;
  if (p <= 0 || r >= p * 0.7) return null;
  const pct = Math.round((1 - r / p) * 100);
  return {
    id: 'exercise',
    label: 'Less exercise',
    detail: `${Math.round(r)} min/day this week vs ${Math.round(p)} min/day over the previous two weeks (−${pct}%).`,
    level: pct >= 50 ? 'attention' : 'watch',
    data: `${recent.length} sessions this week, ${prior.length} in the previous two`,
    evidence: ['nasa-hrp-research#leo', 'csa-why-science#aging'],
    synthetic: [...recent, ...prior].every((x) => syn(x.source.kind)),
  };
}

function vitalSignal(input: HazardInput, metric: VitalType, dir: 'high' | 'low', label: string, evidence: EvidenceRef[]): HazardSignal | null {
  const d = deviation({ measurements: input.measurements, baselines: input.baselines, rules: input.rules, now: input.now }, metric, 3);
  if (!d) return null;
  const z = d.z;
  if (dir === 'high' ? z < 1.5 : z > -1.5) return null;
  const recent = input.measurements.filter((m) => m.type === metric && within(m.takenAt, input.now, 3));
  return {
    id: `${metric}-${dir}`,
    label,
    detail: `Last 3 days ${z > 0 ? 'above' : 'below'} your baseline (robust z ${z.toFixed(1)}).`,
    level: Math.abs(z) >= 2.5 ? 'attention' : 'watch',
    metric,
    data: `${recent.length} readings vs ${input.baselines[metric]?.n ?? 0}-reading baseline`,
    evidence,
    synthetic: recent.length > 0 && recent.every((m) => syn(m.source.kind)),
  };
}

function latestEnv(env: EnvironmentReading[], kind: EnvironmentReading['kind']) {
  return [...env].filter((e) => e.kind === kind).sort((a, b) => b.at.localeCompare(a.at))[0];
}

/* ------------------------------- Hazard assembly ------------------------------- */

const FINDING_HAZARDS = (f: Insight): HazardId[] => {
  if (f.id.startsWith('env:radiation') || f.id === 'env:career-dose') return ['radiation'];
  if (f.id.startsWith('env:')) return ['environment'];
  if (f.id === 'recovery:sleep-debt') return ['isolation'];
  if (f.id === 'pattern:physiological-strain') return ['environment', 'isolation'];
  const m = f.id.match(/^(?:anomaly|rule):([a-z_0-9]+)/);
  return m ? hazardsForMetric(m[1] as VitalType) : [];
};

export function hazardProfiles(input: HazardInput): HazardProfile[] {
  const sleep = sleepSignal(input.sleep, input.now);
  const moods = moodSignals(input.moods, input.now);
  const ex = exerciseSignal(input.exercise, input.now);
  const hrvLow = vitalSignal(input, 'hrv', 'low', 'HRV below baseline', ['nasa-hrp-risks#grouping']);
  const rhrHigh = vitalSignal(input, 'heart_rate', 'high', 'Resting heart rate above baseline', ['nasa-hrp-hazards#gravity', 'nasa-hrp-risks#grouping']);
  const tempHigh = vitalSignal(input, 'temperature', 'high', 'Temperature above baseline', ['nasa-hrp-hazards#closed']);
  const rrHigh = vitalSignal(input, 'respiratory_rate', 'high', 'Breathing rate above baseline', ['nasa-hrp-hazards#closed']);
  const spo2Low = vitalSignal(input, 'spo2', 'low', 'SpO₂ below baseline', ['nasa-hrp-hazards#closed', 'nasa-hrp-risks#grouping']);

  const lastCheckin = [...input.checkins].sort((a, b) => b.at.localeCompare(a.at))[0];
  const checkinSignal: HazardSignal | null =
    lastCheckin && within(lastCheckin.at, input.now, 10) && lastCheckin.score <= 45
      ? {
          id: 'confinement',
          label: 'Confinement check-in',
          detail: `Latest wellbeing check-in ${lastCheckin.score}/100${lastCheckin.lowest ? ` — lowest item: ${lastCheckin.lowest}` : ''}.`,
          level: lastCheckin.score <= 30 ? 'attention' : 'watch',
          data: 'Self-reported confinement check-in (prototype items)',
          evidence: ['nasa-hrp-hazards#isolation'],
          synthetic: false,
        }
      : null;

  // Radiation
  const rate = latestEnv(input.environment, 'radiation_dose_rate');
  const cum = latestEnv(input.environment, 'radiation_cumulative');
  const radSignals: HazardSignal[] = [];
  if (rate && rate.value >= input.rules.expectedDoseRate * 3) {
    radSignals.push({ id: 'dose-rate', label: 'Radiation event level', detail: `Dose rate ${rate.value.toFixed(2)} mSv/day vs expected ${input.rules.expectedDoseRate} mSv/day for this mission type.`, level: 'attention', data: `Dosimeter at ${rate.location}`, evidence: ['lit-dose-rates#rates', 'csa-radiation-monitoring#neutron-share'], synthetic: syn(rate.source.kind) });
  } else if (rate && rate.value >= input.rules.expectedDoseRate * 1.5) {
    radSignals.push({ id: 'dose-rate', label: 'Elevated dose rate', detail: `Dose rate ${rate.value.toFixed(2)} mSv/day (expected ≈${input.rules.expectedDoseRate}).`, level: 'watch', data: `Dosimeter at ${rate.location}`, evidence: ['lit-dose-rates#rates'], synthetic: syn(rate.source.kind) });
  }
  if (cum && cum.value >= input.rules.careerLimitMsv * 0.5) {
    radSignals.push({ id: 'career', label: 'Cumulative dose', detail: `${Math.round(cum.value)} mSv of the ${input.rules.careerLimitMsv} mSv career limit (${Math.round((cum.value / input.rules.careerLimitMsv) * 100)}%).`, level: cum.value >= input.rules.careerLimitMsv * 0.8 ? 'attention' : 'watch', data: 'Cumulative dosimetry', evidence: ['nasa-std-3001#career'], synthetic: syn(cum.source.kind) });
  }

  // Environment
  const co2 = latestEnv(input.environment, 'cabin_co2');
  const envSignals: HazardSignal[] = [spo2Low, tempHigh, rrHigh].filter(Boolean) as HazardSignal[];
  const co2Rule = input.rules.environment.cabin_co2;
  if (co2 && co2Rule?.caution !== undefined && co2.value >= co2Rule.caution) {
    envSignals.push({ id: 'co2', label: 'Cabin CO₂ elevated', detail: `${co2.value.toFixed(1)} mmHg (caution ${co2Rule.caution}).`, level: co2Rule.action !== undefined && co2.value >= co2Rule.action ? 'attention' : 'watch', data: `Cabin sensor, ${co2.location}`, evidence: ['nasa-hrp-hazards#closed'], synthetic: syn(co2.source.kind) });
  }

  // Distance
  const distSignals: HazardSignal[] = [];
  if (!input.linkOnline) distSignals.push({ id: 'link', label: 'No ground link', detail: 'Assessments are running on board; messages and reports are queued until the link returns.', level: 'watch', data: 'Connectivity state', evidence: ['nasa-hrp-hazards#distance'], synthetic: false });
  if (input.mission.commDelaySec >= 60) distSignals.push({ id: 'delay', label: 'Long communication delay', detail: `One-way delay ≈ ${Math.round(input.mission.commDelaySec / 60)} min — ground cannot respond in real time.`, level: 'watch', data: 'Mission profile', evidence: ['csa-why-science#deep-space-risks'], synthetic: false });
  const weightSig = vitalSignal(input, 'weight', 'low', 'Body mass below baseline', ['nasa-hrp-risks#grouping']);
  if (weightSig) distSignals.push(weightSig);

  const byHazard: Record<HazardId, HazardSignal[]> = {
    radiation: radSignals,
    isolation: [sleep, ...moods, checkinSignal, hrvLow, ex].filter(Boolean) as HazardSignal[],
    distance: distSignals,
    gravity: [rhrHigh, ex].filter(Boolean) as HazardSignal[],
    environment: envSignals,
  };

  return HAZARDS.map((h) => {
    const signals = byHazard[h.id];
    const findings = input.findings.filter((f) => f.module !== 'data_quality' && FINDING_HAZARDS(f).includes(h.id));
    const attention = signals.some((s) => s.level === 'attention') || findings.some((f) => f.severity === 'high' || f.severity === 'critical');
    const status: HazardStatus = attention ? 'attention' : signals.length || findings.length ? 'watch' : 'no_signal';
    return { hazard: h.id, status, signals, findings, narrative: narrativeFor(h.id, signals, findings) };
  });
}

function narrativeFor(id: HazardId, signals: HazardSignal[], findings: Insight[]): string {
  const h = HAZARD_BY_ID[id];
  if (!signals.length && !findings.length) return `Nothing linked to ${h.name.toLowerCase()} lately — still watching.`;
  const names = [...signals.map((s) => s.label.toLowerCase()), ...findings.map((f) => f.title.toLowerCase())];
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  const why: Record<HazardId, string> = {
    isolation:
      'NASA groups behavioural changes, sleep loss and teamwork among the risks of isolation and confinement, and is studying crew well-being, activity and sleep on Artemis II (ARCHeR). Changes like these together are worth discussing early — they are common, often temporary, and do not mean a psychological condition has developed.',
    radiation: 'Radiation is considered one of the most hazardous aspects of spaceflight; CosmicPulse tracks dose rate and cumulative dose so exposure events are documented and acted on. A reading does not by itself indicate harm.',
    distance: 'Far from Earth, instructions and medical help arrive late or not at all, so NASA stresses planning and self-sufficiency. CosmicPulse keeps assessments, protocols and evidence available on board.',
    gravity: 'Weightlessness and gravity transitions change the heart, muscles, bones and inner ear. Shifts in resting heart rate or reduced exercise can reflect this adaptation; they are not a diagnosis of deconditioning.',
    environment: 'The spacecraft’s closed environment affects oxygen, CO₂, temperature and immune function. These readings matter because they can change quickly; repeat and confirm before acting on a single value.',
  };
  return `Recent ${list} ${names.length > 1 ? 'are' : 'is'} relevant to ${h.name.toLowerCase()}. ${why[id]}`;
}

export const HAZARD_STATUS_COPY: Record<HazardStatus, { label: string; tone: 'success' | 'info' | 'warning' | 'neutral' }> = {
  no_signal: { label: 'No linked changes', tone: 'success' },
  watch: { label: 'Worth watching', tone: 'info' },
  attention: { label: 'Attention recommended', tone: 'warning' },
  insufficient: { label: 'Not enough data', tone: 'neutral' },
};
