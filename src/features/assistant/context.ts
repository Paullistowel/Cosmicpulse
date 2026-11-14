/* Copied verbatim from the CosmicPulse mobile app (src/features/assistant/context.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { ActivityPrefs } from '@/data/activity';
import type { HealthAlert, Incident, Insight, Measurement, MedicalRecord, Mission, VitalType } from '@/data/types';
import { VITAL_META } from '@/data/vitals';
import { distanceProvenance, fmtDistance, summarize, type Period, type ResolvedDay } from '@/engine/activity';
import type { Baseline } from '@/engine/baseline';
import { searchProtocols } from '@/engine/knowledge/retrieval';
import { sourceLabel } from '@/lib/format';

/**
 * Builds the minimal, privacy-conscious context the cloud assistant needs for
 * ONE question. All numbers come from the deterministic engine — the model
 * explains them, it never computes them. Sections are included only when the
 * question (or the current screen) calls for them; the whole medical record
 * is never sent.
 */

export type ContextInput = {
  question: string;
  screen?: string;
  now: number;
  mission?: Mission;
  measurements: Measurement[];
  baselines: Partial<Record<VitalType, Baseline>>;
  findings: Insight[];
  alerts: HealthAlert[];
  activity?: { days: ResolvedDay[]; prefs: ActivityPrefs; demo: boolean; sourceLabel: string };
  medical?: { allergies: string[]; conditions: string[]; medications: { name: string; strength: string }[]; records: MedicalRecord[]; bloodType?: string };
  incidents?: Incident[];
  devices?: { platform: string; status: string; lastSyncAt?: string; sources: string[] };
};

export type SectionKey = 'vitals' | 'activity' | 'sleep' | 'alerts' | 'medical' | 'protocols' | 'devices' | 'incidents';

const VITAL_WORDS = /heart|pulse|\bhr\b|hrv|variab|oxygen|spo2|saturation|pressure|\bbp\b|temp|fever|breath|respir|vital|reading|measurement|baseline|trend|chart|recovery/i;
const ACTIVITY_WORDS = /step|walk|ran\b|run|distance|far|km|mile|activ|exercise|workout|calorie|kcal|move|goal|stride|fitness|treadmill|gps/i;
const SLEEP_WORDS = /sleep|slept|rest|tired|fatigue|night|recover/i;
const ALERT_WORDS = /alert|warning|finding|anomal|risk|concern|attention|wrong|worry|monitor|indicator/i;
const MEDICAL_WORDS = /medic|allerg|record|condition|history|blood type|prescri|drug|pill|report|summary/i;
const DEVICE_WORDS = /watch|device|connect|sync|apple health|health connect|sensor|wearable|data source/i;
const INCIDENT_WORDS = /incident|emergency|injur|accident/i;
const BROAD = /how (am i|have i been|is my health)|overall|summar|status|analy[sz]e|everything|my health|health (report|summary|trends?|information)/i;

const SCREEN_SECTIONS: Record<string, SectionKey[]> = {
  Home: ['vitals', 'activity', 'alerts'],
  Health: ['vitals', 'sleep'],
  Activity: ['activity'],
  'Vital detail': ['vitals'],
  Medical: ['medical', 'incidents'],
  Emergency: ['vitals', 'medical', 'incidents'],
  Profile: ['devices'],
  Devices: ['devices'],
  AI: [],
};

/** Which sections a question needs. Exported for tests. */
export function sectionsFor(question: string, screen?: string): SectionKey[] {
  const s = new Set<SectionKey>();
  if (VITAL_WORDS.test(question)) s.add('vitals');
  if (ACTIVITY_WORDS.test(question)) s.add('activity');
  if (SLEEP_WORDS.test(question)) s.add('sleep');
  if (ALERT_WORDS.test(question)) s.add('alerts');
  if (MEDICAL_WORDS.test(question)) s.add('medical');
  if (DEVICE_WORDS.test(question)) s.add('devices');
  if (INCIDENT_WORDS.test(question)) s.add('incidents');
  if (BROAD.test(question)) ['vitals', 'activity', 'sleep', 'alerts'].forEach((k) => s.add(k as SectionKey));
  // Deictic questions ("explain this", "what does this mean") use the screen being viewed.
  if (s.size === 0 || /\b(this|these|here)\b/i.test(question)) for (const k of SCREEN_SECTIONS[screen ?? ''] ?? []) s.add(k);
  s.add('protocols');
  return [...s];
}

/** How a reading was obtained — the model must say "historical" or "estimated" rather than imply live monitoring. */
export function provenanceOf(m: Measurement, now: number): 'live' | 'recently synced' | 'historical' | 'manual' | 'simulated' | 'clinician' | 'imported' {
  const k = m.source.kind;
  if (k === 'simulated' || k === 'demo') return 'simulated';
  if (k === 'manual') return 'manual';
  if (k === 'clinician') return 'clinician';
  if (k === 'import') return 'imported';
  const age = now - new Date(m.takenAt).getTime();
  if (k === 'live' && age < 5 * 60_000) return 'live';
  return age < 24 * 3_600_000 ? 'recently synced' : 'historical';
}

const iso = (t: string) => new Date(t).toISOString().slice(0, 16).replace('T', ' ');

function vitals(i: ContextInput) {
  const out: Record<string, unknown> = {};
  for (const type of ['heart_rate', 'hrv', 'spo2', 'blood_pressure', 'temperature', 'respiratory_rate'] as VitalType[]) {
    const series = i.measurements.filter((m) => m.type === type && !m.qualityFlag && new Date(m.takenAt).getTime() <= i.now + 60_000).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
    const latest = series[series.length - 1];
    const meta = VITAL_META[type];
    if (!latest) {
      out[type] = 'no readings available';
      continue;
    }
    const week = series.filter((m) => i.now - new Date(m.takenAt).getTime() < 7 * 86_400_000).map((m) => m.value);
    const today = series.filter((m) => new Date(m.takenAt).toDateString() === new Date(i.now).toDateString()).map((m) => m.value);
    const b = i.baselines[type];
    const fmt = (v: number) => (type === 'blood_pressure' ? Math.round(v) : Number(v.toFixed(meta.decimals)));
    out[type] = {
      unit: meta.unit,
      latest: type === 'blood_pressure' ? `${Math.round(latest.value)}/${Math.round(latest.value2 ?? 0)}` : fmt(latest.value),
      latestAt: iso(latest.takenAt),
      source: sourceLabel(latest.source),
      provenance: provenanceOf(latest, i.now),
      ...(latest.provider ? { provider: latest.provider } : {}),
      ...(today.length ? { todayAverage: fmt(today.reduce((a, v) => a + v, 0) / today.length), todayReadings: today.length } : {}),
      ...(week.length ? { last7Days: { median: fmt([...week].sort((a, c) => a - c)[Math.floor(week.length / 2)]), min: fmt(Math.min(...week)), max: fmt(Math.max(...week)), readings: week.length } } : {}),
      baseline: b && b.quality !== 'insufficient' ? { median: fmt(b.median), usualRange: [fmt(b.p10), fmt(b.p90)], quality: b.quality, readings: b.n } : 'not established',
    };
  }
  return out;
}

function activity(i: ContextInput, question: string) {
  if (!i.activity) return 'no activity data';
  const { days, prefs, demo, sourceLabel: src } = i.activity;
  const periods: Period[] = ['day', 'week', 'month'];
  if (/year|ever|total|lifetime|all time/i.test(question)) periods.push('year', 'lifetime');
  const out: Record<string, unknown> = { source: demo ? 'SIMULATED demo data (not real device data)' : src, stepGoal: prefs.stepGoal };
  for (const p of periods) {
    const s = summarize(days, p, i.now, prefs);
    out[p === 'day' ? 'today' : p === 'week' ? 'thisWeek' : p === 'month' ? 'thisMonth' : p === 'year' ? 'thisYear' : 'allTime'] = {
      range: `${s.start} to ${s.end}`,
      steps: s.steps,
      distance: fmtDistance(s.distanceM),
      distanceProvenance: distanceProvenance(s),
      activeKcal: s.activeKcal ? Math.round(s.activeKcal) : 'not recorded',
      exerciseMinutes: s.exerciseMin ? Math.round(s.exerciseMin) : 'not recorded',
      daysWithData: s.daysWithData,
      ...(p !== 'day'
        ? {
            averageStepsPerDay: Math.round(s.avgStepsPerDay),
            averageDistancePerDay: fmtDistance(s.avgDistancePerDayM),
            mostActiveDay: s.mostActive ?? 'none',
            daysGoalMet: `${Math.round(s.consistency * s.daysWithData)} of ${s.daysWithData}`,
          }
        : { goalProgressPercent: Math.round(s.goalProgress * 100) }),
      ...(s.previous ? { previousPeriod: { steps: s.previous.steps, averageStepsPerDay: Math.round(s.previous.avgStepsPerDay), distance: fmtDistance(s.previous.distanceM) }, changeInAverageStepsPercent: s.changePct === undefined ? null : Math.round(s.changePct * 100) } : {}),
    };
  }
  return out;
}

function sleep(i: ContextInput) {
  const nights = i.measurements.filter((m) => m.type === 'sleep').sort((a, b) => b.takenAt.localeCompare(a.takenAt)).slice(0, 7);
  if (!nights.length) return 'no sleep data available';
  const b = i.baselines.sleep;
  return {
    lastNights: nights.map((n) => ({ wokeAt: iso(n.takenAt), hours: n.value, ...(n.note ? { stages: n.note } : {}), source: sourceLabel(n.source) })),
    baselineHours: b && b.quality !== 'insufficient' ? { median: Number(b.median.toFixed(1)), quality: b.quality } : 'not established',
  };
}

export function buildContext(i: ContextInput): Record<string, unknown> {
  const keys = sectionsFor(i.question, i.screen);
  const ctx: Record<string, unknown> = {
    now: new Date(i.now).toISOString().slice(0, 16),
    ...(i.mission ? { mission: { designator: i.mission.designator, type: i.mission.type, phase: i.mission.phase, day: Math.max(0, Math.floor((i.now - new Date(i.mission.launchedAt).getTime()) / 86_400_000)) } } : {}),
  };
  if (keys.includes('vitals')) ctx.vitals = vitals(i);
  if (keys.includes('activity')) ctx.activity = activity(i, i.question);
  if (keys.includes('sleep')) ctx.sleep = sleep(i);
  if (keys.includes('alerts')) {
    ctx.openAlerts = i.alerts.filter((a) => a.state !== 'resolved').slice(0, 6).map((a) => ({ title: a.title, severity: a.severity, state: a.state, since: iso(a.createdAt) }));
    ctx.findings = i.findings.slice(0, 5).map((f) => ({ title: f.title, kind: f.kind, severity: f.severity, whatChanged: f.whatChanged, why: f.why, uncertainty: f.uncertainty, nextStep: f.nextStep }));
  }
  if (keys.includes('medical') && i.medical) {
    ctx.medical = {
      bloodType: i.medical.bloodType ?? 'not recorded',
      allergies: i.medical.allergies.length ? i.medical.allergies : 'none recorded',
      conditions: i.medical.conditions.length ? i.medical.conditions : 'none recorded',
      activeMedications: i.medical.medications.map((m) => `${m.name} ${m.strength}`),
      recentRecords: i.medical.records.slice(0, 6).map((r) => ({ title: r.title, category: r.category, date: r.date.slice(0, 10) })),
    };
  }
  if (keys.includes('incidents') && i.incidents) ctx.openIncidents = i.incidents.filter((x) => x.status !== 'resolved').slice(0, 4).map((x) => ({ title: x.title, severity: x.severity, status: x.status }));
  if (keys.includes('devices') && i.devices) ctx.devices = i.devices;
  const hits = searchProtocols(i.question, 2).filter((h) => h.score > 2);
  if (hits.length) ctx.protocols = hits.map((h) => ({ id: h.protocol.id, version: h.protocol.version, title: h.protocol.title, steps: h.protocol.steps.map((s) => s.text), escalation: h.protocol.escalation, approval: 'demonstration knowledge base, not flight-approved' }));
  return ctx;
}
