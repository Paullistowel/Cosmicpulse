/* Copied verbatim from the CosmicPulse mobile app (src/features/medical/report-model.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type {
  Administration,
  Astronaut,
  HealthAlert,
  Incident,
  InventoryItem,
  Measurement,
  MedicalRecord,
  Medication,
  Mission,
  UserProfile,
  VitalType,
} from '@/data/types';
import { VITAL_META } from '@/data/vitals';
import { findingCategory } from '@/engine/analysis';
import type { Baseline } from '@/engine/baseline';
import { sourceLabel } from '@/lib/format';
import { CATEGORY_LABEL, DAY, FLIGHT_SURGEON, SEVERITY_LABEL, STATUS_LABEL, bloodTypeFor, commTiming, formatVital, isOpen, latestVitals, sortIncidents } from './lib';

/**
 * Report models for the astronaut medical area, plus print-ready HTML.
 *
 *  - Emergency medical summary: who, blood type, allergies, conditions,
 *    authorised medications, last full vitals set (time + source), open
 *    incidents/alerts, baseline highlights and the flight-surgeon channel.
 *  - Health report: a period summary of vitals vs personal baseline,
 *    incidents, medication administrations and engine alerts.
 *
 * Pure (no native imports). All strings are escaped when rendered.
 */

type Baselines = Partial<Record<VitalType, Baseline>>;

export type SummaryInput = {
  profile: UserProfile;
  crew: Astronaut[];
  astronautId: string;
  mission: Mission;
  records: MedicalRecord[];
  medications: Medication[];
  measurements: Measurement[];
  incidents: Incident[];
  alerts: HealthAlert[];
  baselines?: Baselines;
  demo: boolean;
  now: number;
};

export type SummaryVital = { type: VitalType; label: string; value: string; at: string; source: string };

export type EmergencySummary = {
  generatedAt: string;
  demo: boolean;
  name: string;
  callsign?: string;
  role?: string;
  agency?: string;
  bloodType?: string;
  allergies: string[];
  conditions: string[];
  medications: { name: string; strength: string; instructions: string; authorisedBy?: string; asNeeded: boolean }[];
  vitals: SummaryVital[];
  openIncidents: { id: string; title: string; severity: string; status: string; openedAt: string }[];
  activeAlerts: { id: string; title: string; category: string; severity: string; state: string; createdAt: string }[];
  baselines: { label: string; value: string; detail: string }[];
  mission: { designator: string; name: string; habitat: string; oneWayDelay: string; deepSpace: boolean };
  contacts: { name: string; channel: string; relation: string }[];
};

const BASELINE_HIGHLIGHTS: VitalType[] = ['heart_rate', 'hrv', 'spo2', 'blood_pressure', 'temperature', 'respiratory_rate'];

function baselineText(b: Baseline): string {
  const meta = VITAL_META[b.metric];
  if (b.metric === 'blood_pressure') return `${Math.round(b.median)}/${Math.round(b.median2 ?? 0)} ${meta.unit}`;
  return `${b.median.toFixed(meta.decimals)} ${meta.unit}`;
}

const ALERT_SEVERITY: Record<HealthAlert['severity'], string> = { info: 'For information', low: 'Worth reviewing', moderate: 'Review soon', high: 'Act promptly', critical: 'Urgent' };

export function buildEmergencySummary(d: SummaryInput): EmergencySummary {
  const me = d.crew.find((c) => c.id === d.astronautId);
  const conditionRecords = d.records.filter((r) => r.category === 'condition' && !/^blood type/i.test(r.title)).map((r) => r.title);
  const allergyRecords = d.records.filter((r) => r.category === 'allergy').map((r) => r.title);
  const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
  const comm = commTiming(d.mission);
  return {
    generatedAt: new Date(d.now).toISOString(),
    demo: d.demo,
    name: d.profile.name,
    callsign: me?.callsign,
    role: me?.role.replace(/_/g, ' '),
    agency: me?.agency,
    bloodType: bloodTypeFor(d.crew, d.astronautId, d.records),
    allergies: uniq([...d.profile.allergies, ...allergyRecords.filter((a) => !d.profile.allergies.some((p) => a.toLowerCase().includes(p.toLowerCase())))]),
    conditions: uniq([...d.profile.conditions, ...conditionRecords]),
    medications: d.medications
      .filter((m) => m.active)
      .map((m) => ({ name: m.name, strength: m.strength, instructions: m.instructions, authorisedBy: m.prescriber, asNeeded: m.schedule.frequency === 'as_needed' })),
    vitals: latestVitals(d.measurements).map((m) => ({ type: m.type, label: VITAL_META[m.type].label, value: formatVital(m), at: m.takenAt, source: sourceLabel(m.source) })),
    openIncidents: sortIncidents(d.incidents.filter(isOpen)).map((i) => ({ id: i.id, title: i.title, severity: SEVERITY_LABEL[i.severity], status: STATUS_LABEL[i.status], openedAt: i.openedAt })),
    activeAlerts: d.alerts
      .filter((a) => a.state !== 'resolved')
      .map((a) => ({ id: a.id, title: a.title, category: findingCategory(a), severity: ALERT_SEVERITY[a.severity], state: a.state, createdAt: a.createdAt })),
    baselines: BASELINE_HIGHLIGHTS.flatMap((t) => {
      const b = d.baselines?.[t];
      if (!b || b.quality === 'insufficient') return [];
      return [{ label: VITAL_META[t].label, value: baselineText(b), detail: `${b.quality} · ${b.n} readings` }];
    }),
    mission: { designator: d.mission.designator, name: d.mission.name, habitat: d.mission.habitat, oneWayDelay: comm.oneWay, deepSpace: comm.deepSpace },
    contacts: [
      { name: FLIGHT_SURGEON, channel: 'Priority medical channel (CosmicPulse comms)', relation: 'Flight surgeon' },
      ...(d.profile.emergencyContact && d.profile.emergencyContact.name !== 'Flight surgeon on call'
        ? [{ name: d.profile.emergencyContact.name, channel: d.profile.emergencyContact.phone, relation: d.profile.emergencyContact.relation }]
        : []),
    ],
  };
}

/* ------------------------------ Health report ------------------------------ */

export type ReportRange = 7 | 30 | 90;

export type ReportInput = SummaryInput & { administrations: Administration[]; inventory: InventoryItem[]; rangeDays: ReportRange };

export type VitalReportRow = {
  type: VitalType;
  label: string;
  unit: string;
  count: number;
  avg: string;
  min: string;
  max: string;
  baseline?: string;
  /** Period average relative to the personal baseline p10–p90 band. */
  vsBaseline: 'above' | 'below' | 'within' | 'no_baseline';
  flagged: number;
};

export type HealthReport = {
  title: string;
  generatedAt: string;
  from: string;
  to: string;
  rangeDays: ReportRange;
  demo: boolean;
  name: string;
  callsign?: string;
  mission: string;
  vitals: VitalReportRow[];
  incidents: { id: string; title: string; category: string; severity: string; status: string; openedAt: string }[];
  administrations: { id: string; item: string; quantity: number; at: string; authorisedBy: string; reason: string; recordedBy: string }[];
  alerts: { id: string; title: string; category: string; severity: string; state: string; createdAt: string }[];
};

const REPORT_VITALS: VitalType[] = ['heart_rate', 'hrv', 'spo2', 'blood_pressure', 'respiratory_rate', 'temperature', 'weight', 'sleep'];

export function vitalReportRows(ms: Measurement[], baselines: Baselines = {}): VitalReportRow[] {
  const rows: VitalReportRow[] = [];
  for (const type of REPORT_VITALS) {
    const all = ms.filter((m) => m.type === type);
    if (!all.length) continue;
    const ok = all.filter((m) => !m.qualityFlag);
    const meta = VITAL_META[type];
    const b = baselines[type];
    const base = b && b.quality !== 'insufficient' ? b : undefined;
    const row: VitalReportRow = { type, label: meta.label, unit: meta.unit, count: ok.length, avg: '—', min: '—', max: '—', baseline: base ? baselineText(base) : undefined, vsBaseline: 'no_baseline', flagged: all.length - ok.length };
    if (ok.length) {
      const v = ok.map((m) => m.value);
      const mean = v.reduce((a, x) => a + x, 0) / v.length;
      const f = (x: number) => x.toFixed(meta.decimals);
      if (type === 'blood_pressure') {
        const v2 = ok.map((m) => m.value2 ?? 0);
        const mean2 = v2.reduce((a, x) => a + x, 0) / v2.length;
        row.avg = `${Math.round(mean)}/${Math.round(mean2)}`;
        row.min = `${Math.min(...v)}/${Math.min(...v2)}`;
        row.max = `${Math.max(...v)}/${Math.max(...v2)}`;
      } else {
        row.avg = f(mean);
        row.min = f(Math.min(...v));
        row.max = f(Math.max(...v));
      }
      if (base) row.vsBaseline = mean > base.p90 ? 'above' : mean < base.p10 ? 'below' : 'within';
    }
    rows.push(row);
  }
  return rows;
}

export function buildHealthReport(d: ReportInput): HealthReport {
  const since = d.now - d.rangeDays * DAY;
  const inRange = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= since && t <= d.now;
  };
  const me = d.crew.find((c) => c.id === d.astronautId);
  const items = new Map(d.inventory.map((i) => [i.id, i]));
  return {
    title: `Health report · last ${d.rangeDays} days`,
    generatedAt: new Date(d.now).toISOString(),
    from: new Date(since).toISOString(),
    to: new Date(d.now).toISOString(),
    rangeDays: d.rangeDays,
    demo: d.demo,
    name: d.profile.name,
    callsign: me?.callsign,
    mission: `${d.mission.designator} · ${d.mission.name}`,
    vitals: vitalReportRows(d.measurements.filter((m) => inRange(m.takenAt)), d.baselines),
    incidents: sortIncidents(d.incidents.filter((i) => inRange(i.openedAt) || inRange(i.updatedAt))).map((i) => ({
      id: i.id,
      title: i.title,
      category: CATEGORY_LABEL[i.category],
      severity: SEVERITY_LABEL[i.severity],
      status: STATUS_LABEL[i.status],
      openedAt: i.openedAt,
    })),
    administrations: d.administrations
      .filter((a) => inRange(a.at))
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((a) => {
        const it = items.get(a.itemId);
        return { id: a.id, item: it ? `${it.name} ${it.strength}` : 'Unknown item', quantity: a.quantity, at: a.at, authorisedBy: a.authorisedBy, reason: a.reason, recordedBy: a.recordedBy };
      }),
    alerts: d.alerts
      .filter((a) => inRange(a.createdAt))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((a) => ({ id: a.id, title: a.title, category: findingCategory(a), severity: ALERT_SEVERITY[a.severity], state: a.state, createdAt: a.createdAt })),
  };
}

/* ---------------------------------- HTML ---------------------------------- */

export function escapeHtml(s: string | number | undefined | null): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
const e = escapeHtml;

const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';

const CSS = `
  @page { margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0B1220; font-size: 10.5pt; line-height: 1.45; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0B1220; padding-bottom: 10px; margin-bottom: 12px; }
  .brand { font-size: 16pt; font-weight: 700; letter-spacing: 3px; }
  .mono, .meta { font-family: "JetBrains Mono", Menlo, Consolas, monospace; font-size: 8.5pt; color: #566377; letter-spacing: 0.4px; }
  .meta { text-align: right; }
  h1 { font-size: 19pt; margin: 0 0 6px; font-weight: 600; }
  h2 { font-size: 12pt; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #D3D9E2; page-break-after: avoid; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 18px; }
  .label { display: block; font-family: "JetBrains Mono", Menlo, monospace; color: #566377; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px; }
  .big { font-size: 18pt; font-weight: 600; }
  .crit { color: #B42318; font-weight: 700; }
  .watermark { border: 1.5px dashed #94701F; color: #6B4F12; background: #F6EEDA; padding: 7px 12px; border-radius: 8px; font-weight: 600; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  tr { page-break-inside: avoid; }
  th { text-align: left; font-weight: 600; color: #3A4658; background: #EEF2F6; padding: 5px 7px; border-bottom: 1px solid #D3D9E2; }
  td { padding: 5px 7px; border-bottom: 1px solid #E6EBF1; vertical-align: top; }
  td.num { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .empty { color: #566377; font-style: italic; }
  footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #D3D9E2; font-size: 8pt; color: #566377; }
`;

function table(headers: string[], rows: (string | number | undefined)[][]): string {
  return `<table><thead><tr>${headers.map((h) => `<th scope="col">${e(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${e(c ?? '—')}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

const DEMO_MARK = '<div class="watermark" role="note">Contains synthetic demo data — fictional crewmember and mission. Not for clinical or operational use.</div>';

function doc(title: string, body: string, demo: boolean): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${e(title)}</title><style>${CSS}</style></head><body><main>${body}<footer>Generated by CosmicPulse on board from crew-held data. CosmicPulse does not diagnose or prescribe; administrations are recorded with the human who authorised them.${
    demo ? ' This document contains synthetic demo data.' : ''
  }</footer></main></body></html>`;
}

export function renderSummaryHtml(s: EmergencySummary): string {
  const p: string[] = [];
  p.push(`<header><div class="brand">CosmicPulse</div><div class="meta">EMERGENCY MEDICAL SUMMARY<br/>Generated ${e(fmtDateTime(s.generatedAt))}</div></header>`);
  if (s.demo) p.push(DEMO_MARK);
  p.push(`<h1>${e(s.name)}${s.callsign ? ` · ${e(s.callsign)}` : ''}</h1>`);
  p.push(
    `<div class="grid"><div><span class="label">Blood type</span><span class="big">${e(s.bloodType ?? 'Not recorded')}</span></div><div><span class="label">Allergies</span><span class="${
      s.allergies.length ? 'crit' : ''
    }">${e(s.allergies.join(', ') || 'None recorded')}</span></div><div><span class="label">Role</span>${e(s.role ?? '—')}</div><div><span class="label">Mission</span>${e(s.mission.designator)}<br/><span class="mono">${e(
      s.mission.habitat,
    )} · one-way delay ${e(s.mission.oneWayDelay)}</span></div></div>`,
  );
  p.push('<h2>Active conditions</h2>');
  p.push(s.conditions.length ? `<p>${e(s.conditions.join(' · '))}</p>` : '<p class="empty">None recorded.</p>');
  p.push('<h2>Authorised medications</h2>');
  p.push(s.medications.length ? table(['Medication', 'Strength', 'Instructions (as authorised)', 'Authorised by'], s.medications.map((m) => [m.name, m.strength, m.instructions, m.authorisedBy])) : '<p class="empty">No active medications.</p>');
  p.push('<h2>Last vitals</h2>');
  p.push(s.vitals.length ? table(['Vital', 'Value', 'Taken', 'Source'], s.vitals.map((v) => [v.label, v.value, fmtDateTime(v.at), v.source])) : '<p class="empty">No vitals on board.</p>');
  p.push('<h2>Open incidents</h2>');
  p.push(s.openIncidents.length ? table(['Incident', 'Severity', 'Status', 'Opened'], s.openIncidents.map((i) => [i.title, i.severity, i.status, fmtDateTime(i.openedAt)])) : '<p class="empty">No open incidents.</p>');
  p.push('<h2>Active alerts</h2>');
  p.push(s.activeAlerts.length ? table(['Alert', 'Category', 'Severity', 'State', 'Raised'], s.activeAlerts.map((a) => [a.title, a.category, a.severity, a.state, fmtDateTime(a.createdAt)])) : '<p class="empty">No active alerts.</p>');
  if (s.baselines.length) {
    p.push('<h2>Personal baseline</h2>');
    p.push(table(['Measure', 'Baseline (median)', 'Basis'], s.baselines.map((b) => [b.label, b.value, b.detail])));
  }
  p.push('<h2>Contacts</h2>');
  p.push(table(['Name', 'Relation', 'Channel'], s.contacts.map((c) => [c.name, c.relation, c.channel])));
  return doc(`Emergency medical summary — ${s.name}`, p.join('\n'), s.demo);
}

const VS_TEXT: Record<VitalReportRow['vsBaseline'], string> = { above: 'Above baseline band', below: 'Below baseline band', within: 'Within baseline band', no_baseline: 'No baseline yet' };

export function renderHealthReportHtml(r: HealthReport): string {
  const p: string[] = [];
  p.push(`<header><div class="brand">CosmicPulse</div><div class="meta">HEALTH REPORT<br/>${e(fmtDateTime(r.from))} → ${e(fmtDateTime(r.to))}</div></header>`);
  if (r.demo) p.push(DEMO_MARK);
  p.push(`<h1>${e(r.title)}</h1><p class="mono">${e(r.name)}${r.callsign ? ` · ${e(r.callsign)}` : ''} · ${e(r.mission)}</p>`);
  p.push('<h2>Vitals vs personal baseline</h2>');
  p.push(
    r.vitals.length
      ? table(
          ['Measure', 'Readings', 'Average', 'Lowest', 'Highest', 'Unit', 'Baseline', 'Comparison'],
          r.vitals.map((v) => [v.label, `${v.count}${v.flagged ? ` (+${v.flagged} flagged)` : ''}`, v.avg, v.min, v.max, v.unit, v.baseline ?? '—', VS_TEXT[v.vsBaseline]]),
        ) + '<p class="mono">Baseline band = personal p10–p90. Readings flagged by a quality check are excluded. A difference from baseline is a statistical pattern, not a diagnosis.</p>'
      : '<p class="empty">No readings in this period.</p>',
  );
  p.push('<h2>Incidents</h2>');
  p.push(r.incidents.length ? table(['Incident', 'Category', 'Severity', 'Status', 'Opened'], r.incidents.map((i) => [i.title, i.category, i.severity, i.status, fmtDateTime(i.openedAt)])) : '<p class="empty">No incidents in this period.</p>');
  p.push('<h2>Medication administrations</h2>');
  p.push(
    r.administrations.length
      ? table(['When', 'Item', 'Qty', 'Authorised by', 'Reason', 'Recorded by'], r.administrations.map((a) => [fmtDateTime(a.at), a.item, a.quantity, a.authorisedBy, a.reason, a.recordedBy]))
      : '<p class="empty">No administrations recorded in this period.</p>',
  );
  p.push('<h2>Alerts</h2>');
  p.push(r.alerts.length ? table(['Raised', 'Alert', 'Category', 'Severity', 'State'], r.alerts.map((a) => [fmtDateTime(a.createdAt), a.title, a.category, a.severity, a.state])) : '<p class="empty">No alerts in this period.</p>');
  return doc(`${r.title} — ${r.name}`, p.join('\n'), r.demo);
}
