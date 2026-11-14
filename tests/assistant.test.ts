import { describe, expect, it } from 'vitest';

import { buildPool } from '@/data/demo/pool';
import { buildScenario } from '@/data/demo/scenarios';
import { runEngine, type AssistantData } from '@/engine';
import { ask, researchAnswer, triage } from '@/services/assistant';

const NOW = Date.now();
function data(): AssistantData {
  const d = buildScenario('iss_illness');
  const pool = buildPool('iss_illness', 'none', NOW);
  const e = runEngine({ mission: d.mission, phaseStartedAt: d.phaseStartedAt, measurements: pool.measurements, environment: pool.environment, sleep: pool.sleepRecords, alerts: [], autonomy: 3, now: NOW }, () => 'a');
  return { measurements: pool.measurements, baselines: e.baselines, findings: e.findings, alerts: e.alerts, mission: d.mission, medications: [], now: NOW, dataSource: { state: 'demo', reason: 'test' } };
}

describe('assistant routing', () => {
  it('triages emergencies and crises on device before anything else', async () => {
    expect(triage('I have chest pain')).toBe('emergency');
    expect(triage('I want to hurt myself')).toBe('crisis');
    let called = false;
    const r = await ask('I can’t breathe', data(), { consent: true, cloud: true, post: async () => ((called = true), {}) });
    expect(r.route).toBe('triage');
    expect(called).toBe(false);
  });
  it('refuses dosing on device and never forwards it', async () => {
    let called = false;
    const r = await ask('How many mg of melatonin should I take?', data(), { consent: true, cloud: true, post: async () => ((called = true), {}) });
    expect(r.message.answerKind).toBe('refusal');
    expect(called).toBe(false);
  });
  it('answers research questions from the evidence library with citations', async () => {
    const r = await ask('What does NASA say about space radiation?', data(), { consent: true, cloud: false });
    expect(r.route).toBe('onboard');
    expect(r.message.citations?.length).toBeGreaterThan(0);
    expect(r.message.text).toMatch(/radiation/i);
  });
  it('falls back to the on-board answer when the cloud model fails', async () => {
    const r = await ask('Explain my recent heart-rate trends', data(), { consent: true, cloud: true, post: async () => { throw new Error('503'); } });
    expect(r.route).toBe('onboard');
    expect(r.groundError).toBe('503');
  });
  it('uses the cloud reply and attaches evidence context when available', async () => {
    let body: { context?: { evidence?: unknown[] } } = {};
    const r = await ask('How could isolation affect my sleep?', data(), { consent: true, cloud: true, post: async (b) => { body = b as typeof body; return { text: 'Cloud says hi. [NASA HRP: 5 Hazards of Human Spaceflight]', model: 'test-model' }; } });
    expect(r.route).toBe('ground');
    expect(body.context?.evidence?.length).toBeGreaterThan(0);
    expect(r.message.engine).toMatch(/test-model/);
  });
  it('returns null research answer for gibberish', () => {
    expect(researchAnswer('xqzv wplk')).toBeNull();
  });
});
