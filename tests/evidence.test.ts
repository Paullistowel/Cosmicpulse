import { describe, expect, it } from 'vitest';

import type { Insight } from '@/data/types';
import { evidenceForFinding } from '@/intel/evidence';
import { HAZARDS, HRP_RISKS, HRP_STUDIES } from '@/research/hazards';
import { searchEvidence } from '@/research/search';
import { CHALLENGE_SOURCES, SOURCES, resolveRef } from '@/research/sources';
import i4 from '@/research/data/inspiration4.json';

describe('evidence library integrity', () => {
  it('includes exactly the five official challenge resources', () => {
    expect(CHALLENGE_SOURCES.map((s) => s.url).sort()).toEqual(
      [
        'https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp',
        'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp',
        'https://www.nasa.gov/hrp/hazards/',
        'https://www.nasa.gov/hrp/ongoing-hrp-research/',
        'https://www.nasa.gov/hrp/risks/',
      ].sort(),
    );
  });
  it('gives every source full provenance', () => {
    for (const s of SOURCES) {
      expect(s.url, s.id).toMatch(/^https:\/\//);
      expect(s.retrievedAt, s.id).toBeTruthy();
      expect(s.usage, s.id).toBeTruthy();
      expect(s.attribution, s.id).toBeTruthy();
    }
  });
  it('resolves every hazard science reference to a real fact', () => {
    for (const h of HAZARDS) for (const sc of h.science) expect(resolveRef(sc.ref)?.fact, `${h.id} → ${sc.ref}`).toBeDefined();
  });
  it('lists all 17 HRP risks and only known ids on hazards', () => {
    expect(HRP_RISKS).toHaveLength(17);
    for (const h of HAZARDS) {
      for (const r of h.riskIds) expect(HRP_RISKS.some((x) => x.id === r)).toBe(true);
      for (const st of h.studyIds) expect(HRP_STUDIES.some((x) => x.id === st)).toBe(true);
    }
  });
  it('separates prototype guidance from agency science (protocols cited by id only)', () => {
    for (const h of HAZARDS) expect(h.protocolIds.every((id) => /^AEG-/.test(id))).toBe(true);
  });
});

describe('evidence search', () => {
  it('finds the CSA neutron fact for a radiation question', () => {
    const hits = searchEvidence('neutron radiation on the ISS');
    expect(hits[0].ref).toBe('csa-radiation-monitoring#neutron-share');
  });
  it('returns nothing for unrelated text', () => {
    expect(searchEvidence('zzzz qqqq')).toEqual([]);
  });
});

describe('finding evidence', () => {
  const f = (id: string): Insight => ({ id, kind: 'statistical_anomaly', module: 'vitals', title: '', summary: '', severity: 'moderate', detectedAt: '', whatChanged: '', why: '', contributing: [], uncertainty: '', nextStep: '', status: 'new', method: '' });
  it('maps a radiation event to the radiation hazard with dose-rate evidence first', () => {
    const e = evidenceForFinding({ ...f('env:radiation-event'), module: 'environment' });
    expect(e.hazards).toEqual(['radiation']);
    expect(e.refs[0]).toBe('lit-dose-rates#rates');
  });
  it('maps a low-SpO₂ anomaly to closed environment and the hypoxia risk', () => {
    const e = evidenceForFinding(f('anomaly:spo2:low'));
    expect(e.hazards).toContain('environment');
    expect(e.risks.map((r) => r.id)).toContain('hypoxia');
  });
});

describe('Inspiration4 OSDR snapshot', () => {
  it('holds real per-crew values with provenance', () => {
    expect(i4.panels.map((p) => p.osd)).toEqual(['OSD-575', 'OSD-569']);
    const glucose = i4.panels[0].analytes.find((a) => a.key === 'glucose')!;
    expect(new Set(glucose.points.map((p) => p.crew))).toEqual(new Set(['C001', 'C002', 'C003', 'C004']));
    expect(glucose.unit).toBe('mg/dL');
    expect(i4.panels[0].fileUrl).toMatch(/^https:\/\/osdr\.nasa\.gov\//);
    expect(i4.retrievedAt).toBeTruthy();
  });
});
