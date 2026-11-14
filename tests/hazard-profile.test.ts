import { describe, expect, it } from 'vitest';

import { buildPool } from '@/data/demo/pool';
import { buildScenario } from '@/data/demo/scenarios';
import type { MoodEntry, SleepRecord } from '@/data/types';
import { runEngine } from '@/engine';
import { hazardProfiles, moodSignals, sleepSignal } from '@/intel/hazard-profile';

const DAY = 86_400_000;
const NOW = Date.now();
const night = (d: number, hours: number): SleepRecord => ({ id: `s${d}`, night: new Date(NOW - d * DAY).toISOString(), hours, quality: 60, disruptions: 1, medicationAssisted: false, source: { kind: 'manual' } });
const mood = (d: number, m: number, s: number): MoodEntry => ({ id: `m${d}`, at: new Date(NOW - d * DAY).toISOString(), mood: m as 1, energy: 3, stress: s as 1, tags: [] });

function profiles(scenario: Parameters<typeof buildScenario>[0], condition: Parameters<typeof buildPool>[1], extra: { moods?: MoodEntry[] } = {}) {
  const d = buildScenario(scenario);
  const pool = buildPool(scenario, condition, NOW);
  const e = runEngine({ mission: d.mission, phaseStartedAt: d.phaseStartedAt, measurements: pool.measurements, environment: pool.environment, sleep: pool.sleepRecords, alerts: [], autonomy: 3, now: NOW }, () => 'x');
  return hazardProfiles({ mission: d.mission, measurements: pool.measurements, baselines: e.baselines, rules: e.rules, findings: e.findings, sleep: pool.sleepRecords, exercise: pool.exercise, environment: pool.environment, moods: extra.moods ?? [], checkins: [], linkOnline: true, now: NOW });
}

describe('sleep signal', () => {
  it('is silent for a stable 7 h pattern', () => {
    expect(sleepSignal([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((d) => night(d, 7.2)), NOW)).toBeNull();
  });
  it('flags a drop from ~7.2 h to ~5 h as attention', () => {
    const s = sleepSignal([...[1, 2, 3, 4].map((d) => night(d, 5)), ...[6, 7, 8, 9, 10, 11].map((d) => night(d, 7.2))], NOW);
    expect(s?.level).toBe('attention');
    expect(s?.evidence.length).toBeGreaterThan(0);
  });
});

describe('mood signals', () => {
  it('detects lower mood and higher stress vs the previous three weeks', () => {
    const ms = [mood(1, 2, 4), mood(3, 2, 5), mood(10, 4, 2), mood(14, 4, 2), mood(20, 4, 2)];
    const ids = moodSignals(ms, NOW).map((s) => s.id);
    expect(ids).toEqual(['mood', 'stress']);
  });
  it('needs at least two recent check-ins', () => {
    expect(moodSignals([mood(1, 1, 5)], NOW)).toEqual([]);
  });
});

describe('hazard profiles', () => {
  it('covers all five NASA hazards', () => {
    expect(profiles('iss_nominal', 'none').map((p) => p.hazard)).toEqual(['radiation', 'isolation', 'distance', 'gravity', 'environment']);
  });
  it('links a multi-signal strain pattern to environment and isolation, with synthetic data flagged', () => {
    const p = profiles('iss_nominal', 'persistent_multi');
    const env = p.find((x) => x.hazard === 'environment')!;
    expect(env.status).not.toBe('no_signal');
    expect(env.findings.some((f) => f.id === 'pattern:physiological-strain')).toBe(true);
    expect(env.signals.every((s) => s.synthetic)).toBe(true);
  });
  it('explains isolation relevance without claiming a condition', () => {
    const p = profiles('iss_nominal', 'sleep_change', { moods: [mood(1, 2, 4), mood(2, 2, 4), mood(12, 4, 2), mood(15, 4, 2), mood(18, 4, 2)] });
    const iso = p.find((x) => x.hazard === 'isolation')!;
    expect(iso.status).toBe('attention');
    expect(iso.narrative).toMatch(/do not mean a psychological condition/);
  });
  it('flags a solar particle event under radiation', () => {
    const rad = profiles('spe_event', 'none').find((x) => x.hazard === 'radiation')!;
    expect(rad.status).toBe('attention');
  });
});
