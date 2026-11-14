import type { HazardId } from '@/research/hazards';
import type { SystemId } from '@/twin/systems';

/**
 * Mission Scenario Simulator — EDUCATIONAL, not predictive.
 *
 * Inputs are scenario assumptions chosen by the user. Outputs are tagged:
 *  - 'evidence'     — arithmetic on published values (dose rates, career limit)
 *  - 'assumption'   — a user-chosen parameter, echoed back
 *  - 'hypothetical' — an illustrative 0–100 stress index from a simple,
 *                     documented formula. It is NOT a validated risk model and
 *                     says nothing about any individual.
 */
export type Destination = 'iss' | 'lunar_surface' | 'mars_transit' | 'mars_surface';

export const DESTINATIONS: Record<Destination, { label: string; doseRate: number; gravity: number; delayMin: number; ref: string }> = {
  iss: { label: 'ISS / low Earth orbit', doseRate: 0.5, gravity: 0, delayMin: 0, ref: 'lit-dose-rates#rates' },
  lunar_surface: { label: 'Lunar surface', doseRate: 1.4, gravity: 0.165, delayMin: 0.02, ref: 'lit-dose-rates#rates' },
  mars_transit: { label: 'Mars transit', doseRate: 1.8, gravity: 0, delayMin: 12, ref: 'lit-dose-rates#rates' },
  mars_surface: { label: 'Mars surface', doseRate: 0.64, gravity: 0.375, delayMin: 12, ref: 'nasa-hrp-hazards#gravity-mars' },
};

export type ScenarioInput = {
  destination: Destination;
  durationDays: number;
  /** Share of time spent in a shielded area during radiation events (assumption). */
  shieldingPct: number;
  exerciseMin: number;
  sleepH: number;
  crewSize: number;
  priorDoseMsv: number;
};

export const DEFAULT_SCENARIO: ScenarioInput = { destination: 'iss', durationDays: 180, shieldingPct: 30, exerciseMin: 120, sleepH: 7, crewSize: 4, priorDoseMsv: 50 };

export type Tag = 'evidence' | 'assumption' | 'hypothetical';
export type Output = { id: string; label: string; value: string; detail: string; tag: Tag; level?: number; hazard: HazardId };

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
/** Illustrative shielding effect: up to 30% of daily dose avoided at 100% shelter use (assumption, stated in UI). */
export const SHIELD_MAX_REDUCTION = 0.3;

export function simulate(i: ScenarioInput): { outputs: Output[]; systems: Partial<Record<SystemId, number>> } {
  const d = DESTINATIONS[i.destination];
  const dose = i.durationDays * d.doseRate * (1 - SHIELD_MAX_REDUCTION * (i.shieldingPct / 100));
  const career = i.priorDoseMsv + dose;
  const pct = (career / 600) * 100;

  // Hypothetical indices — simple monotone formulas, documented in docs/SIMULATOR.md.
  const gravityIdx = clamp((1 - d.gravity / 0.375 * 0.5) * (Math.min(i.durationDays, 900) / 900) * 100 * (1 - Math.min(i.exerciseMin, 150) / 300));
  const isolationIdx = clamp((Math.min(i.durationDays, 1000) / 1000) * 60 + (6 - Math.min(i.crewSize, 6)) * 5 + Math.max(0, 7 - i.sleepH) * 8 + Math.min(d.delayMin, 24) * 0.8);
  const distanceIdx = clamp(Math.min(d.delayMin, 24) * 3 + (Math.min(i.durationDays, 1000) / 1000) * 30);
  const envIdx = clamp(20 + (Math.min(i.durationDays, 1000) / 1000) * 30 + Math.max(0, 7 - i.sleepH) * 6);

  const outputs: Output[] = [
    { id: 'dose', label: 'Mission radiation dose', value: `${Math.round(dose)} mSv`, detail: `${i.durationDays} days × ${d.doseRate} mSv/day (published typical rate), reduced by the shielding assumption.`, tag: 'evidence', hazard: 'radiation' },
    { id: 'career', label: 'Career dose after mission', value: `${Math.round(career)} mSv · ${Math.round(pct)}% of limit`, detail: 'Prior dose (your assumption) + mission dose, against the 600 mSv NASA-STD-3001 career limit.', tag: 'evidence', level: clamp(pct), hazard: 'radiation' },
    { id: 'delay', label: 'One-way communication delay', value: d.delayMin < 1 ? `${Math.round(d.delayMin * 60)} s` : `up to ~${Math.round(d.delayMin)} min`, detail: 'Light-time to Earth; Mars delay varies with planetary distance (up to ~22 min). Shown as a typical value.', tag: 'evidence', hazard: 'distance' },
    { id: 'gravity', label: 'Unloading stress index', value: `${gravityIdx}/100`, detail: 'Hypothetical: rises with time in low gravity, falls with countermeasure exercise. Illustrates why exercise matters — not a bone or muscle prediction.', tag: 'hypothetical', level: gravityIdx, hazard: 'gravity' },
    { id: 'isolation', label: 'Isolation & confinement index', value: `${isolationIdx}/100`, detail: 'Hypothetical: rises with duration, smaller crews, short sleep and longer delays. Not a behavioural-health prediction.', tag: 'hypothetical', level: isolationIdx, hazard: 'isolation' },
    { id: 'distance', label: 'Self-sufficiency demand index', value: `${distanceIdx}/100`, detail: 'Hypothetical: how much on-board autonomy the scenario demands (delay + duration).', tag: 'hypothetical', level: distanceIdx, hazard: 'distance' },
    { id: 'environment', label: 'Closed-habitat exposure index', value: `${envIdx}/100`, detail: 'Hypothetical: cumulative time in a sealed habitat, with poor sleep amplifying it.', tag: 'hypothetical', level: envIdx, hazard: 'environment' },
    { id: 'sleep', label: 'Planned sleep', value: `${i.sleepH} h/night`, detail: i.sleepH < 7 ? 'Below the 7 h adult recommendation (AASM/CDC) — a NASA HRP behavioural risk.' : 'Meets the 7 h adult recommendation.', tag: 'assumption', hazard: 'isolation' },
  ];
  return {
    outputs,
    systems: { musculoskeletal: gravityIdx, cardiovascular: clamp(gravityIdx * 0.8), neuro: isolationIdx, immune: clamp((pct + envIdx) / 2), respiratory: envIdx, metabolic: clamp(distanceIdx * 0.6) },
  };
}

export const TAG_COPY: Record<Tag, { label: string; tone: 'info' | 'neutral' | 'demo'; detail: string }> = {
  evidence: { label: 'Scientific evidence', tone: 'info', detail: 'Arithmetic on published values with citations.' },
  assumption: { label: 'Scenario assumption', tone: 'neutral', detail: 'A value you chose.' },
  hypothetical: { label: 'Hypothetical outcome', tone: 'demo', detail: 'Illustrative index from a simple formula — not a prediction.' },
};
