import type { Insight, Measurement, VitalType } from '@/data/types';
import type { Baseline } from '@/engine';
import { explainFinding } from '@/engine/explain';
import { escapeHtml } from '@/features/medical/report-model';
import type { HazardProfile } from '@/intel/hazard-profile';
import { evidenceForFinding } from '@/intel/evidence';
import { HAZARD_BY_ID } from '@/research/hazards';
import { resolveRef } from '@/research/sources';

/**
 * Flight-surgeon brief: a deterministic, printable summary of every current
 * finding (with the 8-point explanation), the hazard profile and the evidence
 * cited. No AI text — every sentence comes from the engine or the evidence
 * library, so it can be trusted offline.
 */
export function renderBriefHtml(i: { name: string; mission: string; findings: Insight[]; hazards: HazardProfile[]; measurements: Measurement[]; baselines: Partial<Record<VitalType, Baseline>>; demo: boolean; now: number }) {
  const e = escapeHtml;
  const f = i.findings.map((x) => {
    const ex = explainFinding(x, { measurements: i.measurements, baselines: i.baselines, now: i.now });
    const ev = evidenceForFinding(x);
    const refs = ev.refs.slice(0, 3).map((r) => resolveRef(r)).filter(Boolean).map((r) => `<li>${e(r!.fact?.text ?? r!.source.summary)} <span class="src">[${e(r!.source.org)}: ${e(r!.source.title)}]</span></li>`).join('');
    return `<section class="f"><h3>${e(x.title)} <span class="tag">${e(ex.tierLabel)}</span>${x.simulated ? ' <span class="tag demo">SYNTHETIC</span>' : ''}</h3>
      <table><tr><th>Indicator</th><td>${e(ex.metricLabel)}</td></tr>
      <tr><th>Measurement</th><td>${e(ex.latest ? `${ex.latest.text} · ${new Date(ex.latest.takenAt).toUTCString()} · ${ex.latest.source}` : x.contributing.map((c) => `${c.label} ${c.value}`).join('; '))}</td></tr>
      <tr><th>Baseline</th><td>${e(ex.baseline)}</td></tr>
      <tr><th>Deviation</th><td>${e(x.whatChanged)} ${e(ex.persistence.text)}</td></tr>
      <tr><th>Rule</th><td>${e(x.why)}</td></tr>
      <tr><th>Uncertainty</th><td>${e(x.uncertainty)}</td></tr>
      <tr><th>Hazards</th><td>${e(ev.hazards.map((h) => HAZARD_BY_ID[h].name).join(', ') || '—')}</td></tr>
      <tr><th>Next steps</th><td>${e(ex.nextSteps.join(' '))}</td></tr></table>
      ${refs ? `<ul class="refs">${refs}</ul>` : ''}</section>`;
  });
  const hz = i.hazards.map((h) => `<tr><td>${e(HAZARD_BY_ID[h.hazard].name)}</td><td>${e(h.status.replace('_', ' '))}</td><td>${e([...h.signals.map((s) => `${s.label}: ${s.detail}`), ...h.findings.map((x) => x.title)].join(' · ') || '—')}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Flight surgeon brief — ${e(i.name)}</title><style>
  body{font:13px/1.45 -apple-system,Inter,Segoe UI,sans-serif;color:#1e2124;margin:32px;max-width:820px}
  h1{font-size:22px;margin:0}h2{font-size:15px;margin:22px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}h3{font-size:14px;margin:0 0 6px}
  .meta{color:#5d625f}.banner{background:#f2ead6;color:#8a6a22;padding:8px 12px;border-radius:8px;margin:12px 0;font-weight:600}
  table{border-collapse:collapse;width:100%}th,td{text-align:left;vertical-align:top;padding:4px 8px;border-bottom:1px solid #eee}th{width:120px;color:#5d625f;font-weight:500}
  .f{margin:14px 0;padding:12px;border:1px solid #e3e3df;border-radius:10px;break-inside:avoid}.tag{font-size:11px;background:#dceaef;color:#25799c;padding:2px 6px;border-radius:99px;font-weight:500}.tag.demo{background:#f2ead6;color:#8a6a22}
  .refs{margin:8px 0 0;padding-left:18px;color:#5d625f}.src{color:#25799c}footer{margin-top:24px;color:#8c908b;font-size:11px}
  </style></head><body>
  <h1>Flight surgeon brief</h1><p class="meta">${e(i.name)} · ${e(i.mission)} · generated ${e(new Date(i.now).toUTCString())}</p>
  ${i.demo ? '<div class="banner">Contains SYNTHETIC / DEMO DATA — not real astronaut measurements.</div>' : ''}
  <h2>Current findings (${i.findings.length})</h2>${f.join('') || '<p>No current findings.</p>'}
  <h2>Spaceflight hazard profile</h2><table><tr><th>Hazard</th><th>Status</th><th>Linked changes</th></tr>${hz}</table>
  <footer>CosmicPulse — rule-based prototype analysis; not a diagnosis; not clinically validated. Evidence: NASA HRP, CSA, NASA OSDR (see NASA_DATA_SOURCES.md). Decisions belong to authorised medical personnel.</footer>
  </body></html>`;
}
