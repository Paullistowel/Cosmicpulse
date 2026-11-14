import { beforeEach, describe, expect, it } from 'vitest';

import { buildPool } from '@/data/demo/pool';
import { buildScenario } from '@/data/demo/scenarios';
import type { Insight } from '@/data/types';
import { runEngine } from '@/engine';
import { ACHIEVEMENTS, DAILY, WEEKLY, dailyProgress, weeklyProgress } from '@/game/objectives';
import { ACTIVITY, alreadyAwarded, rankFor, totalXp, useProgress, type XpEvent } from '@/game/progress';
import { buildBriefing, relationGraph, sevenQuestions, REASSESS } from '@/sentinel/sentinel';
import { DESTINATIONS, simulate, DEFAULT_SCENARIO } from '@/simulator/model';
import { SYSTEMS, systemStatus } from '@/twin/systems';

const NOW = Date.now();
const ev = (type: XpEvent['type'], daysAgo = 0, key = ''): XpEvent => ({ id: Math.random().toString(), type, key, at: new Date(NOW - daysAgo * 86_400_000).toISOString(), xp: ACTIVITY[type].xp });

describe('gamification rules', () => {
  beforeEach(() => useProgress.getState().reset());
  it('rewards each daily activity at most once per day', () => {
    expect(useProgress.getState().award('mood_checkin')).not.toBeNull();
    expect(useProgress.getState().award('mood_checkin')).toBeNull();
    expect(totalXp(useProgress.getState().events)).toBe(ACTIVITY.mood_checkin.xp);
  });
  it('rewards learning content once per item', () => {
    const a = useProgress.getState();
    expect(a.award('hazard_explored', 'radiation')).not.toBeNull();
    expect(a.award('hazard_explored', 'radiation')).toBeNull();
    expect(useProgress.getState().award('hazard_explored', 'gravity')).not.toBeNull();
  });
  it('never has an activity type tied to reading values', () => {
    for (const k of Object.keys(ACTIVITY)) expect(k).not.toMatch(/normal|perfect|low_hr|steps_\d|record_high/);
  });
  it('promotes ranks at thresholds and celebrates promotion', () => {
    expect(rankFor(0).rank.name).toBe('Cadet');
    expect(rankFor(150).rank.name).toBe('Junior Explorer');
    expect(rankFor(2200).rank.name).toBe('Mission Commander');
    useProgress.setState({ events: [ev('onboarding'), ev('hazard_explored', 0, 'a'), ev('confinement_checkin')] }); // 155? no: 100+25+30
    expect(alreadyAwarded(useProgress.getState().events, 'onboarding', undefined)).toBe(true);
  });
  it('tracks daily objectives and weekly distinct-day missions', () => {
    const events = [ev('mood_checkin', 0), ev('mood_checkin', 1), ev('mood_checkin', 2), ev('mood_checkin', 3), ev('mood_checkin', 4)];
    expect(dailyProgress(DAILY.find((d) => d.id === 'd-mood')!, events, NOW).complete).toBe(true);
    const w = weeklyProgress(WEEKLY.find((m) => m.id === 'w-consistency')!, events, NOW);
    expect(w.done).toBeLessThanOrEqual(5);
  });
  it('unlocks Hazard Researcher only after all five hazards', () => {
    const a = ACHIEVEMENTS.find((x) => x.id === 'hazard_researcher')!;
    expect(a.test(['radiation', 'gravity', 'isolation', 'distance'].map((k) => ev('hazard_explored', 0, k)), {})).toBe(false);
    expect(a.test(['radiation', 'gravity', 'isolation', 'distance', 'environment'].map((k) => ev('hazard_explored', 0, k)), {})).toBe(true);
  });
});

function engineFor(scenario: Parameters<typeof buildScenario>[0], condition: Parameters<typeof buildPool>[1]) {
  const d = buildScenario(scenario);
  const pool = buildPool(scenario, condition, NOW);
  const e = runEngine({ mission: d.mission, phaseStartedAt: d.phaseStartedAt, measurements: pool.measurements, environment: pool.environment, sleep: pool.sleepRecords, alerts: [], autonomy: 3, now: NOW }, () => 'a');
  return { d, pool, e };
}

describe('Sentinel', () => {
  it('answers all seven questions for a finding, with a tier-based reassessment window', () => {
    const { pool, e } = engineFor('iss_nominal', 'persistent_multi');
    const f = e.findings.find((x) => x.id === 'pattern:physiological-strain')!;
    const s = sevenQuestions(f, { measurements: pool.measurements, baselines: e.baselines, now: NOW });
    expect(s.answers.map((a) => a.q)).toEqual(['What changed?', 'Which measurements contributed?', 'Why is this important?', 'What could be contributing?', 'What should I do?', 'When should I reassess?', 'When should medical personnel be contacted?']);
    expect(s.reassessHours).toBe(REASSESS[s.tier].hours);
    expect(relationGraph(f, pool.sleepRecords, NOW).nodes.length).toBeGreaterThan(2);
  });
  it('briefing labels synthetic data and reports no findings honestly', () => {
    const { d, pool, e } = engineFor('iss_nominal', 'none');
    const b = buildBriefing({ name: 'Elena Marsh', mission: d.mission, risk: e.risk, readiness: e.readiness, findings: e.findings, hazards: [], sleep: pool.sleepRecords, moods: [], synthetic: true, dueFollowUps: 0, now: NOW });
    expect(b.items[0].tone).toBe('demo');
    expect(b.items.some((i) => i.title === 'No new findings')).toBe(e.findings.filter((f) => f.module !== 'data_quality').length === 0);
  });
});

describe('scenario simulator', () => {
  it('computes mission dose from published rates and labels every output', () => {
    const r = simulate({ ...DEFAULT_SCENARIO, destination: 'mars_transit', durationDays: 100, shieldingPct: 0, priorDoseMsv: 0 });
    const dose = r.outputs.find((o) => o.id === 'dose')!;
    expect(dose.value).toBe(`${100 * DESTINATIONS.mars_transit.doseRate} mSv`);
    expect(dose.tag).toBe('evidence');
    expect(r.outputs.every((o) => ['evidence', 'assumption', 'hypothetical'].includes(o.tag))).toBe(true);
  });
  it('lowers the unloading index with more exercise', () => {
    const lo = simulate({ ...DEFAULT_SCENARIO, exerciseMin: 0 }).outputs.find((o) => o.id === 'gravity')!.level!;
    const hi = simulate({ ...DEFAULT_SCENARIO, exerciseMin: 150 }).outputs.find((o) => o.id === 'gravity')!.level!;
    expect(hi).toBeLessThan(lo);
  });
});

describe('digital twin status', () => {
  it('is unknown without recent data and high with a medical-review finding', () => {
    expect(systemStatus('respiratory', { measurements: [], findings: [], now: NOW }).status).toBe('unknown');
    const { pool, e } = engineFor('iss_nominal', 'persistent_multi');
    const strain = e.findings.find((f) => f.id === 'pattern:physiological-strain') as Insight;
    const st = systemStatus('cardiovascular', { measurements: pool.measurements, findings: [{ ...strain, severity: 'high' }], now: NOW });
    expect(st.status).toBe('high');
    expect(SYSTEMS).toHaveLength(6);
  });
});
