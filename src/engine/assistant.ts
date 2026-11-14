/* Copied verbatim from the CosmicPulse mobile app (src/engine/assistant.ts) by scripts/sync-mobile-core.mjs.
 * Edit the mobile original and re-run `npm run sync:mobile`; do not edit this copy. */
import type { ActivityPrefs } from '@/data/activity';
import type { HealthAlert, Insight, Measurement, Mission, Protocol, VitalType } from '@/data/types';
import { VITAL_META } from '@/data/vitals';
import { distanceProvenance, fmtDistance, summarize, type Period, type ResolvedDay } from './activity';
import { findingCategory } from './analysis';
import { explainFinding as explainStructured, TIER_OF, TIER_COPY } from './explain';
import { BASELINE_SOURCE_COPY, median, type Baseline } from './baseline';
import { KB_VERSION, findProtocol } from './knowledge/protocols';
import { searchProtocols } from './knowledge/retrieval';

/**
 * On-device grounded assistant (offline inference).
 *
 * Deterministic intent routing over the astronaut's own data and the
 * versioned knowledge base. It never generates medical instructions of its
 * own: protocol answers quote knowledge-base steps verbatim with id + version;
 * data answers quote computed statistics; everything else is declined with a
 * pointer to the flight surgeon. When a ground model is reachable the service
 * layer may use it instead, with the same grounding contract.
 */

export const ASSISTANT_ENGINE = `cosmicpulse-onboard-assistant 1.0.0 · KB ${KB_VERSION}`;

export type AssistantData = {
  measurements: Measurement[];
  baselines: Partial<Record<VitalType, Baseline>>;
  findings: Insight[];
  alerts: HealthAlert[];
  mission?: Mission;
  medications: string[];
  now: number;
  /** Resolved daily activity (real platform data, or labelled demo data). */
  activity?: { days: ResolvedDay[]; prefs: ActivityPrefs; demo: boolean; sourceLabel: string };
  /** Active data source (REAL / DEMO / MIXED) and why demo data is shown. */
  dataSource?: { state: 'real' | 'demo' | 'mixed'; reason?: string };
};

const isSyn = (m: Measurement) => m.source.kind === 'simulated' || m.source.kind === 'demo';
const demoWhy = (d: AssistantData) => (d.dataSource?.reason ? ` You are viewing demo data because ${d.dataSource.reason}.` : ' This is simulated demo data.');

export type GroundedAnswer = {
  kind: 'protocol' | 'explanation' | 'summary' | 'refusal' | 'missing' | 'overview' | 'unsupported' | 'help';
  text: string;
  protocols: Protocol[];
  dataUsed: string[];
};

const METRIC_WORDS: [RegExp, VitalType][] = [
  [/\bhrv\b|variability/i, 'hrv'],
  [/heart[ -]?rate|\bhr\b|pulse/i, 'heart_rate'],
  [/spo2|oxygen|saturation/i, 'spo2'],
  [/blood pressure|\bbp\b/i, 'blood_pressure'],
  [/temp|fever/i, 'temperature'],
  [/resp|breathing rate/i, 'respiratory_rate'],
  [/sleep/i, 'sleep'],
  [/weight|mass/i, 'weight'],
];

const DOSING = /(dose|dosage|how (many|much) (mg|tablets?|pills?)|should i take|prescribe|increase my|double)/i;
const fmt = (t: VitalType, v: number) => v.toFixed(VITAL_META[t].decimals);

function protocolAnswer(protocols: Protocol[], lead: string): GroundedAnswer {
  const p = protocols[0];
  const steps = p.steps.map((s, i) => `${i + 1}. ${s.text}${s.caution ? ` ⚠ ${s.caution}` : ''}`).join('\n');
  const more = protocols.slice(1).map((x) => `${x.title} (${x.id})`);
  return {
    kind: 'protocol',
    text: `${lead}${p.title} — ${p.id} v${p.version}\n\n${p.summary}\n\n${steps}\n\nEscalation: ${p.escalation}${more.length ? `\n\nAlso relevant: ${more.join('; ')}.` : ''}\n\nThis knowledge base is demo content and is not flight-approved.`,
    protocols,
    dataUsed: [],
  };
}

function explainFinding(f: Insight, d?: AssistantData): GroundedAnswer {
  const ps = (f.protocolIds ?? []).map(findProtocol).filter(Boolean) as Protocol[];
  const alert = d?.alerts.find((a) => a.fingerprint === f.id && a.state !== 'resolved');
  const ex = d ? explainStructured(f, { measurements: d.measurements, baselines: d.baselines, now: d.now, alert }) : undefined;
  const parts = [
    `${f.simulated ? 'SIMULATED · ' : ''}${f.title} — ${TIER_COPY[TIER_OF[f.severity]].label}`,
    f.summary,
    ex?.latest ? `Measurement: ${ex.latest.text} at ${new Date(ex.latest.takenAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${ex.latest.source} (${ex.latest.status}).` : '',
    ex ? `Personal baseline: ${ex.baseline}` : '',
    `Why it was flagged: ${f.why}`,
    ex ? ex.persistence.text : `What changed: ${f.whatChanged}`,
    ex?.outcome ? `Since the alert: ${ex.outcome.text}` : '',
    `Suggested next steps:\n${(ex?.nextSteps ?? [f.nextStep]).map((x) => `• ${x}`).join('\n')}`,
    ps.length ? `Relevant protocol: ${ps.map((p) => `${p.title} (${p.id} v${p.version})`).join('; ')}.` : '',
    'This is a rule-based observation, not a diagnosis — it does not establish a medical condition.',
  ].filter(Boolean);
  return { kind: 'explanation', text: parts.join('\n\n'), protocols: ps, dataUsed: [f.simulated ? 'Simulated readings' : 'Your readings', ...f.contributing.map((c) => `${c.label}: ${c.value}`)] };
}

/** Latest reading for one metric, stated with its provenance. */
function latestReading(type: VitalType, d: AssistantData): GroundedAnswer {
  const meta = VITAL_META[type];
  const last = d.measurements.filter((m) => m.type === type && !m.qualityFlag && new Date(m.takenAt).getTime() <= d.now + 60_000).sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0];
  if (!last) return summariseMetric(type, d);
  const value = type === 'blood_pressure' ? `${Math.round(last.value)}/${Math.round(last.value2 ?? 0)}` : fmt(type, last.value);
  const when = new Date(last.takenAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const src = 'deviceName' in last.source ? last.source.deviceName : last.source.kind === 'manual' ? 'entered manually' : last.source.kind;
  const b = d.baselines[type];
  const rel = b && b.quality !== 'insufficient' ? ` Your usual range is ${fmt(type, b.p10)}–${fmt(type, b.p90)} ${meta.unit}.` : ' A personal baseline isn’t established yet.';
  const text = isSyn(last)
    ? `Your simulated ${meta.label.toLowerCase()} reading is ${value} ${meta.unit} (${when}).${demoWhy(d)}${rel}`
    : `Your latest ${meta.label.toLowerCase()} reading is ${value} ${meta.unit}, recorded ${when} (${src}).${rel}`;
  return { kind: 'summary', text, protocols: [], dataUsed: [`Latest ${meta.label.toLowerCase()} reading`, isSyn(last) ? 'Simulated demo data' : 'Real reading'] };
}

/** Abnormal readings / alerts, or the subset worth discussing with the medical team. */
function abnormalities(d: AssistantData, forTeam: boolean): GroundedAnswer {
  const open = d.alerts.filter((a) => a.state !== 'resolved');
  const fs = d.findings.filter((f) => f.module !== 'environment' && (forTeam ? ['moderate', 'high', 'critical'].includes(f.severity) : f.severity !== 'info'));
  if (!fs.length) {
    return { kind: 'overview', text: forTeam ? 'Nothing in your current data meets the threshold for medical-team review. Mention anything you feel is wrong regardless of what the data shows.' : `No unusual readings or trends were detected in the last 7 days.${d.dataSource?.state === 'demo' ? demoWhy(d) : ''}`, protocols: [], dataUsed: ['Latest analysis', 'Alerts'] };
  }
  const lines = fs
    .sort((a, b) => ['critical', 'high', 'moderate', 'low', 'info'].indexOf(a.severity) - ['critical', 'high', 'moderate', 'low', 'info'].indexOf(b.severity))
    .map((f) => `• ${f.simulated ? '[SIMULATED] ' : ''}${f.title} — ${TIER_COPY[TIER_OF[f.severity]].label}. ${f.summary}`);
  const lead = forTeam ? 'Readings worth discussing with the medical team:' : `Unusual readings and trends this week (${open.length} open alert${open.length === 1 ? '' : 's'}):`;
  const tail = fs.some((f) => f.simulated) ? `\n\nItems marked SIMULATED come from demo data, not your body.` : '';
  return { kind: 'summary', text: `${lead}\n${lines.join('\n')}${tail}\n\nAsk “why was … flagged?” for the full explanation of any item. These are rule-based observations, not diagnoses.`, protocols: [], dataUsed: ['Latest analysis', 'Alerts'] };
}

/** "Has my resting heart rate improved?" — last 3 days vs the 7 days before, deterministic. */
function improvement(type: VitalType, d: AssistantData): GroundedAnswer {
  const meta = VITAL_META[type];
  const day = 86_400_000;
  const inWin = (from: number, to: number) => d.measurements.filter((m) => m.type === type && !m.qualityFlag && d.now - new Date(m.takenAt).getTime() >= from * day && d.now - new Date(m.takenAt).getTime() < to * day).map((m) => m.value);
  const recent = inWin(0, 3);
  const before = inWin(3, 10);
  if (recent.length < 2 || before.length < 2) return { kind: 'missing', text: `There aren’t enough ${meta.label.toLowerCase()} readings in the last 10 days to judge a change.`, protocols: [], dataUsed: [] };
  const a = median(before);
  const b = median(recent);
  const lowerIsBetter = type === 'heart_rate' || type === 'respiratory_rate' || type === 'temperature' || type === 'blood_pressure';
  const delta = b - a;
  const small = Math.abs(delta) < (type === 'spo2' ? 1 : type === 'temperature' ? 0.2 : type === 'sleep' ? 0.4 : 2);
  const verdict = small ? 'about the same' : (lowerIsBetter ? delta < 0 : delta > 0) ? 'improved' : 'moved in the less favourable direction';
  const sim = d.measurements.some((m) => m.type === type && isSyn(m)) ? ` (simulated readings —${demoWhy(d).replace(' You are viewing demo data because', '')})` : '';
  return { kind: 'summary', text: `${meta.label}: median ${fmt(type, a)} ${meta.unit} over the previous week vs ${fmt(type, b)} ${meta.unit} over the last 3 days — ${verdict}${sim}. Trends are informational; persistent changes should be discussed with the medical team.`, protocols: [], dataUsed: [`${before.length + recent.length} ${meta.label.toLowerCase()} readings (10 days)`] };
}

function summariseMetric(type: VitalType, d: AssistantData): GroundedAnswer {
  const meta = VITAL_META[type];
  const series = d.measurements.filter((m) => m.type === type && !m.qualityFlag);
  const week = series.filter((m) => d.now - new Date(m.takenAt).getTime() < 7 * 86_400_000);
  const b = d.baselines[type];
  if (!series.length) {
    return {
      kind: 'missing',
      text: `I don’t have any ${meta.label.toLowerCase()} readings for you yet, so I can’t summarise it. Add a reading or connect a sensor that measures it (Profile → Devices).`,
      protocols: [],
      dataUsed: [],
    };
  }
  if (!week.length) {
    const last = series[series.length - 1];
    return {
      kind: 'missing',
      text: `There are no ${meta.label.toLowerCase()} readings in the last 7 days. The most recent was ${fmt(type, last.value)} ${meta.unit} on ${new Date(last.takenAt).toLocaleDateString()}. Check the sensor before relying on this metric.`,
      protocols: [],
      dataUsed: ['Last reading'],
    };
  }
  const vals = week.map((m) => m.value);
  const med = median(vals);
  const lines = [
    `${meta.label}, last 7 days: ${week.length} readings, median ${fmt(type, med)} ${meta.unit}, range ${fmt(type, Math.min(...vals))}–${fmt(type, Math.max(...vals))}.`,
  ];
  if (b && b.quality !== 'insufficient') {
    const z = (med - b.median) / b.spread;
    lines.push(
      `Your baseline is ${fmt(type, b.median)} ${meta.unit} (usual range ${fmt(type, b.p10)}–${fmt(type, b.p90)}; ${b.quality}). ${BASELINE_SOURCE_COPY[b.source]}.`,
      Math.abs(z) < 1 ? 'This week is in line with your baseline.' : `This week is ${z > 0 ? 'above' : 'below'} your baseline (${Math.abs(z).toFixed(1)} robust SD).`,
    );
  } else {
    lines.push('There isn’t enough data yet to establish your personal baseline for this metric.');
  }
  if (week.every(isSyn)) lines.unshift(`SIMULATED data.${demoWhy(d)}`);
  const related = d.findings.filter((f) => f.contributing.some((c) => c.measurementType === type));
  if (related.length) lines.push(`Related findings: ${related.map((f) => `${f.title} (${findingCategory(f)})`).join('; ')}.`);
  return { kind: 'summary', text: lines.join('\n\n'), protocols: [], dataUsed: [`${week.length} ${meta.label.toLowerCase()} readings (7 days)`, b ? `${meta.label} baseline (${b.n} readings)` : 'No baseline'] };
}

const STATUS_VITALS: VitalType[] = ['heart_rate', 'hrv', 'spo2', 'blood_pressure', 'temperature', 'respiratory_rate'];

/** Latest quality-passing reading per vital with its deviation from the personal baseline. */
function vitalStatus(d: AssistantData) {
  return STATUS_VITALS.flatMap((type) => {
    const latest = d.measurements
      .filter((m) => m.type === type && !m.qualityFlag && new Date(m.takenAt).getTime() <= d.now + 60_000)
      .sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0];
    if (!latest) return [];
    const b = d.baselines[type];
    const z = b && b.quality !== 'insufficient' && b.spread > 0 ? (latest.value - b.median) / b.spread : undefined;
    const value = type === 'blood_pressure' ? `${Math.round(latest.value)}/${Math.round(latest.value2 ?? 0)}` : fmt(type, latest.value);
    return [{ type, latest, value, z, outside: z !== undefined && Math.abs(z) >= 2 }];
  });
}

function overview(d: AssistantData): GroundedAnswer {
  const open = d.alerts.filter((a) => a.state !== 'resolved');
  const vitals = vitalStatus(d);
  const outside = vitals.filter((v) => v.outside);
  const vitalLines = vitals.map((v) => {
    const meta = VITAL_META[v.type];
    const rel = v.z === undefined ? 'no baseline yet' : Math.abs(v.z) < 1 ? 'in line with your baseline' : `${v.z > 0 ? 'above' : 'below'} baseline (${Math.abs(v.z).toFixed(1)} SD)`;
    return `• ${meta.label}: ${v.value} ${meta.unit} — ${rel}`;
  });
  const lines = [
    d.mission ? `Mission ${d.mission.designator}, day ${Math.max(1, Math.ceil((d.now - new Date(d.mission.launchedAt).getTime()) / 86_400_000))}, phase ${d.mission.phase.replace('_', ' ')}.` : 'No mission profile loaded.',
    outside.length
      ? `Overall: ${outside.length} of ${vitals.length} key vitals sit outside your usual range (${outside.map((v) => VITAL_META[v.type].shortLabel).join(', ')}).`
      : vitals.length
        ? `Overall: all ${vitals.length} key vitals with a baseline are within your usual range.`
        : 'Overall: there are no vital-sign readings stored yet, so I can’t assess how you’ve been. Connect Apple Health or Health Connect (Profile › Connected devices) or record a reading, and I’ll compare it with your baseline.',
    vitalLines.length ? `Latest readings:\n${vitalLines.join('\n')}` : '',
    vitals.some((v) => v.latest.source.kind === 'simulated' || v.latest.source.kind === 'demo') ? `Note: some or all of these are SIMULATED demo readings, not measurements from a real device.${demoWhy(d)}` : '',
    open.length ? `${open.length} open alert${open.length > 1 ? 's' : ''}: ${open.slice(0, 4).map((a) => a.title).join('; ')}.` : 'No open alerts.',
    d.findings.length ? `Top finding: ${d.findings[0].title} (${findingCategory(d.findings[0])}). Next step: ${d.findings[0].nextStep}` : 'No findings from the latest analysis.',
    'This is a rule-based comparison with your own baselines, for information only — not a diagnosis. Discuss any concern with your crew medical officer.',
  ].filter(Boolean);
  return { kind: 'overview', text: lines.join('\n\n'), protocols: [], dataUsed: ['Mission profile', 'Latest vitals vs baseline', 'Alerts', 'Latest analysis'] };
}

/** "What should I monitor?" — prioritised from the astronaut's own findings, deviations and data gaps. */
function monitoring(d: AssistantData): GroundedAnswer {
  const vitals = vitalStatus(d);
  const items: string[] = [];
  for (const f of d.findings.slice(0, 3)) items.push(`• ${f.title} — ${f.nextStep}`);
  for (const v of vitals.filter((x) => x.outside && !d.findings.some((f) => f.contributing.some((c) => c.measurementType === x.type)))) {
    items.push(`• ${VITAL_META[v.type].label} — latest ${v.value} ${VITAL_META[v.type].unit} is outside your usual range; re-measure at rest.`);
  }
  const missing = STATUS_VITALS.filter((t) => !vitals.some((v) => v.type === t));
  const stale = vitals.filter((v) => d.now - new Date(v.latest.takenAt).getTime() > 36 * 3_600_000);
  if (missing.length) items.push(`• No recent ${missing.map((t) => VITAL_META[t].label.toLowerCase()).join(', ')} data — check the sensor or add a manual reading.`);
  if (stale.length) items.push(`• Stale data: ${stale.map((v) => VITAL_META[v.type].label.toLowerCase()).join(', ')} not updated for over 36 h.`);
  const routine = 'Routine in-flight indicators: resting heart rate and HRV (recovery), SpO₂, blood pressure, temperature, sleep duration, and cabin CO₂ / radiation exposure.';
  return {
    kind: 'summary',
    text: `${items.length ? `Priorities from your data:\n${items.join('\n')}` : 'Nothing in your data needs closer monitoring right now.'}\n\n${routine}\n\nMonitoring plans are set by your flight surgeon; this list is informational.`,
    protocols: [],
    dataUsed: ['Latest analysis', 'Latest vitals vs baseline', 'Data freshness'],
  };
}

const ACTIVITY_Q = /\bsteps?\b|walk|distance|how far|travel|\bactive\b|activity|exercise|workout|calorie|kcal|step goal|activity goal/i;

function activityAnswer(q: string, d: AssistantData): GroundedAnswer | null {
  if (!ACTIVITY_Q.test(q)) return null;
  const a = d.activity;
  if (!a || !a.days.length) {
    return { kind: 'missing', text: 'I don’t have any activity records yet. Connect Apple Health or Health Connect (Profile › Connected devices) or start an outdoor session from Activity.', protocols: [], dataUsed: [] };
  }
  const period: Period = /month/i.test(q) ? 'month' : /year/i.test(q) ? 'year' : /ever|all time|lifetime|total/i.test(q) ? 'lifetime' : /week/i.test(q) ? 'week' : 'day';
  const s = summarize(a.days, period, d.now, a.prefs);
  const label = { day: 'Today', week: 'This week', month: 'This month', year: 'This year', lifetime: 'In total' }[period];
  const src = a.demo ? ' These are SIMULATED demo numbers, not real device data.' : ` Source: ${a.sourceLabel}.`;
  const lines: string[] = [];
  if (/far|distance|km|travel/i.test(q)) {
    lines.push(`${label} you have covered ${fmtDistance(s.distanceM)} (${distanceProvenance(s)}), over ${s.steps.toLocaleString('en-US')} steps.`);
  } else {
    lines.push(`${label} you have taken ${s.steps.toLocaleString('en-US')} steps and covered ${fmtDistance(s.distanceM)} (${distanceProvenance(s)}).`);
  }
  if (period === 'day') lines.push(`That is ${Math.round(s.goalProgress * 100)}% of your ${s.goal.toLocaleString('en-US')}-step goal.`);
  else {
    lines.push(`Average ${Math.round(s.avgStepsPerDay).toLocaleString('en-US')} steps/day over ${s.daysWithData} day${s.daysWithData === 1 ? '' : 's'} with data; goal met on ${Math.round(s.consistency * s.daysWithData)} of them.`);
    if (s.mostActive) lines.push(`Most active day: ${s.mostActive.date} (${s.mostActive.steps.toLocaleString('en-US')} steps).`);
  }
  if ((/compare|last|previous|than|change/i.test(q) || period !== 'day') && s.previous && s.changePct !== undefined) {
    const prevLabel = { day: 'yesterday', week: 'last week', month: 'last month', year: 'last year', lifetime: '' }[period];
    lines.push(`Compared with ${prevLabel}, your average steps per day are ${s.changePct >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(s.changePct * 100))}% (${Math.round(s.previous.avgStepsPerDay).toLocaleString('en-US')} → ${Math.round(s.avgStepsPerDay).toLocaleString('en-US')}).`);
  }
  if (s.activeKcal) lines.push(`Active energy: ${Math.round(s.activeKcal)} kcal; exercise: ${Math.round(s.exerciseMin)} min.`);
  return { kind: 'summary', text: lines.join(' ') + src, protocols: [], dataUsed: [`Activity records (${label.toLowerCase()})`, a.demo ? 'Simulated demo activity' : a.sourceLabel] };
}

/** Offline application guidance (mirrors the cloud assistant's app knowledge). */
function appHelp(q: string): GroundedAnswer | null {
  const help = (text: string): GroundedAnswer => ({ kind: 'help', text, protocols: [], dataUsed: ['CosmicPulse app guide'] });
  if (/^(good (morning|afternoon|evening)|hello|hi|hey)\b/i.test(q.trim()) && q.trim().split(/\s+/).length <= 5) {
    return help('Hello. Your latest available health and activity information is ready. Ask for a health summary, today’s steps, or anything about your readings.');
  }
  if (/connect|pair|link|sync/i.test(q) && /watch|apple health|health connect|device|wearable|fitbit|garmin|samsung/i.test(q)) {
    return help('To connect a smartwatch: open Profile › Connected devices › Apple Health (iPhone) or Health Connect (Android), tap Connect and allow the data categories. Apple Watch data arrives through the iPhone’s Apple Health after the watch syncs; on Android the watch’s companion app must write to Health Connect. Then use Sync now. Real device access needs an installed CosmicPulse build — Expo Go cannot read health data.');
  }
  if (/how (do|can) i|where/i.test(q) && /emergenc|sos/i.test(q)) {
    return help('Tap the red siren button at the top of any screen (also on Home and Medical). Choose the incident category and severity, describe what is happening, and record the report. CosmicPulse captures current vitals, shows approved first-response guidance and tracks acknowledgement. It stores the report on board and syncs it to ground when a link exists — it does not call mission control by itself, so also use vehicle comms.');
  }
  if (/where|find|open|see/i.test(q) && /medical record|records|allerg|medication|history/i.test(q)) {
    return help('Medical records are under Medical › Medical records (history, allergies, labs, imaging, documents). Medications are under Medical › Medications, and the one-page emergency summary with PDF export is under Medical › Emergency medical summary.');
  }
  if (/what (does|can|is)|features|capabilit/i.test(q) && /cosmicpulse|aegis|this app|you do/i.test(q)) {
    return help('CosmicPulse monitors your vitals against your personal baseline, tracks steps, distance and workouts from your watch and phone, explains trends and anomalies, manages medical records and the medication inventory, provides emergency assistance with approved guidance, and keeps working offline. You can ask me by text or voice from any screen.');
  }
  return null;
}

export function answer(question: string, d: AssistantData): GroundedAnswer {
  const q = question.trim();

  if (DOSING.test(q)) {
    return {
      kind: 'refusal',
      text: 'I can’t recommend, calculate or change medication doses. Medication use must follow your authorised medical record or be directed by the flight surgeon. I can show what is recorded in your medication record, or open a message to the flight surgeon.',
      protocols: [],
      dataUsed: [],
    };
  }

  const help = appHelp(q);
  if (help) return help;

  const act = activityAnswer(q, d);
  if (act) return act;

  const qMetric = METRIC_WORDS.find(([re]) => re.test(q))?.[1];
  if (/discuss|medical team|flight surgeon|doctor/i.test(q) && /reading|which|what/i.test(q)) return abnormalities(d, true);
  if (/abnormal|unusual|changed significantly|significant(ly)? chang|flagged readings|any (readings|changes)/i.test(q) && !/why/i.test(q)) return abnormalities(d, false);
  if (qMetric && /improv|better|worse|getting/i.test(q)) return improvement(qMetric, d);
  if (qMetric && /^(what('?s| is)|show) (my|me my) (current |latest )?/i.test(q) && !/trend|week|month|baseline|why/i.test(q)) return latestReading(qMetric, d);
  if (/what should i do|next steps?/i.test(q) && /alert|this|flag/i.test(q)) {
    const top = d.findings.find((f) => d.alerts.some((a) => a.fingerprint === f.id && a.state !== 'resolved')) ?? d.findings[0];
    if (top) return explainFinding(top, d);
  }

  const asksTrend = /trend|summar|how (is|are|has) my/i.test(q);
  const trendMetric = METRIC_WORDS.find(([re]) => re.test(q))?.[1];

  // Sleep + recovery: sleep duration plus HRV, the recovery marker.
  if (/sleep/i.test(q) && /recover/i.test(q)) {
    const a = summariseMetric('sleep', d);
    const b = summariseMetric('hrv', d);
    return { kind: 'summary', text: `Sleep\n\n${a.text}\n\nRecovery (heart-rate variability)\n\n${b.text}`, protocols: [], dataUsed: [...a.dataUsed, ...b.dataUsed] };
  }

  // Trend questions about a named metric go straight to the data summary.
  if (asksTrend && trendMetric) return summariseMetric(trendMetric, d);

  if (/(what|which).*(monitor|watch|keep an eye|indicator)|indicators/i.test(q)) return monitoring(d);

  // "Why" about an alert or finding.
  if (/\bwhy\b|explain|what does .* mean|alert|flag/i.test(q)) {
    const target =
      d.findings.find((f) => q.toLowerCase().includes(f.title.toLowerCase().split(' ')[0])) ??
      (METRIC_WORDS.find(([re]) => re.test(q)) ? d.findings.find((f) => f.contributing.some((c) => c.measurementType === METRIC_WORDS.find(([re]) => re.test(q))![1])) : undefined) ??
      (/alert/i.test(q) ? d.findings.find((f) => d.alerts.some((a) => a.fingerprint === f.id && a.state !== 'resolved')) : undefined);
    if (target) return explainFinding(target, d);
    if (/alert/i.test(q)) {
      const latestAlert = [...d.alerts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const f = latestAlert && d.findings.find((x) => x.id === latestAlert.insightId || x.id === latestAlert.fingerprint);
      if (f) return explainFinding(f, d);
      if (!d.alerts.some((a) => a.state !== 'resolved')) {
        return { kind: 'overview', text: 'You have no open health alerts. The engine re-checks your data every minute against your personal baselines and mission rules.', protocols: [], dataUsed: ['Alerts'] };
      }
    }
  }

  // Procedure / protocol lookup.
  if (/procedure|protocol|what (do|should) (i|we) do|how (do|to) (i |we )?(treat|handle|respond)|checklist|steps/i.test(q) || searchProtocols(q, 1)[0]?.score > 4) {
    const hits = searchProtocols(q, 3);
    if (hits.length) return protocolAnswer(hits.map((h) => h.protocol), 'From the onboard knowledge base:\n\n');
  }

  const metric = METRIC_WORDS.find(([re]) => re.test(q))?.[1];
  if (metric) return summariseMetric(metric, d);

  if (/status|overview|how am i|how (has|have|is) my health|health been|how have i been|overall|my health|summary|today|analy[sz]e/i.test(q)) return overview(d);

  const hits = searchProtocols(q, 3);
  if (hits.length) return protocolAnswer(hits.map((h) => h.protocol), 'I found these related protocols:\n\n');

  return {
    kind: 'unsupported',
    text: 'I don’t have approved information to answer that on board. I can explain your measurements and alerts, summarise trends, or look up a protocol in the onboard knowledge base. For anything else, message the flight surgeon.',
    protocols: [],
    dataUsed: [],
  };
}
