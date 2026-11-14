import { describe, expect, it } from 'vitest';

import type { Measurement } from '@/data/types';
import { scoreCheckin } from '@/intel/checkins';
import { summarise } from '@/services/data-source';
import { toMeasurement } from '@/services/web-bluetooth';
import { toStudy } from '@/server/osdr';

const m = (type: Measurement['type'], kind: 'manual' | 'simulated'): Measurement => ({ id: Math.random().toString(), type, value: 60, unit: 'bpm', takenAt: new Date().toISOString(), source: kind === 'manual' ? { kind } : { kind, deviceId: 'd', deviceName: 'Sim' } });

describe('confinement check-in scoring', () => {
  it('maps all-best answers to 100 and inverts the monotony item', () => {
    expect(scoreCheckin({ connection: 5, crew: 5, monotony: 1, privacy: 5, workload: 5, rest: 5 }).score).toBe(100);
    const low = scoreCheckin({ connection: 1, crew: 3, monotony: 3, privacy: 3, workload: 3, rest: 3 });
    expect(low.lowest).toMatch(/Connection/);
  });
});

describe('data source summary', () => {
  const base = { activityReal: false, activityDemo: false, simulationOn: true, signedIn: false, bleConnected: false };
  it('reports demo, mixed and real states', () => {
    expect(summarise({ ...base, measurements: [m('heart_rate', 'simulated')] }).state).toBe('demo');
    expect(summarise({ ...base, measurements: [m('heart_rate', 'manual'), m('spo2', 'simulated')] }).state).toBe('mixed');
    expect(summarise({ ...base, measurements: [m('heart_rate', 'manual')] }).state).toBe('real');
    expect(summarise({ ...base, measurements: [] }).state).toBe('empty');
  });
  it('never lists a metric as synthetic when a real reading exists', () => {
    const s = summarise({ ...base, measurements: [m('heart_rate', 'manual'), m('heart_rate', 'simulated')] });
    expect(s.real).toContain('heart_rate');
    expect(s.simulated).not.toContain('heart_rate');
  });
});

describe('Web Bluetooth normalisation', () => {
  const dev = { id: 'ble-1', name: 'Cuff' };
  it('converts kPa blood pressure to mmHg and keeps the original', () => {
    const r = toMeasurement({ type: 'blood_pressure', value: 16, value2: 10.7, unit: 'kPa' }, dev);
    expect(r.value).toBe(120);
    expect(r.value2).toBe(80);
    expect(r.original?.unit).toBe('kPa');
    expect(r.source).toEqual({ kind: 'live', deviceId: 'ble-1', deviceName: 'Cuff' });
  });
  it('converts °F and lb to canonical units', () => {
    expect(toMeasurement({ type: 'temperature', value: 98.6, unit: 'degF' }, dev).value).toBe(37);
    expect(toMeasurement({ type: 'weight', value: 154.3, unit: 'lb' }, dev).value).toBe(70);
  });
});

describe('OSDR mapping', () => {
  it('maps a search hit to a study with a repository URL', () => {
    const s = toStudy({ _source: { Accession: 'OSD-575', 'Study Title': 'T', 'Study Description': 'D', organism: 'Homo sapiens', 'Project Type': 'Spaceflight Study', 'Study Public Release Date': 1715644800, Mission: { Name: 'SpaceX Inspiration4' }, 'Study Assay Measurement Type': 'Complete Blood Count     transcription profiling' } });
    expect(s.url).toBe('https://osdr.nasa.gov/bio/repo/data/studies/OSD-575');
    expect(s.assays).toEqual(['Complete Blood Count', 'transcription profiling']);
    expect(s.releaseDate).toBe('2024-05-14');
  });
});
